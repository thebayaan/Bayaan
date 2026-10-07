import {createMemoryContentRegistry, emptyRow} from '../contentRegistry';
import {
  BACKOFF_MS,
  installResource,
  removeResource,
  runContentCheck,
  type EngineDeps,
} from '../contentEngine';
import type {ContentApi, ManifestResult} from '../contentApi';
import type {
  ContentEnvelope,
  ContentInstaller,
  Manifest,
} from '@/types/content';

const KEY = 'qf:tafsirs:169';

function envelope(version: number): ContentEnvelope {
  return {
    envelope: 1,
    key: KEY,
    version,
    source: 'qf',
    fetched_at: 'x',
    snapshot: {
      resource_group: 'tafsirs',
      resource_id: 169,
      schema_version: 1,
      records: [],
    },
  };
}

function manifest(
  entries: Manifest['resources'],
  paused = false,
): ManifestResult {
  return {
    status: 'ok',
    manifest: {format: 1, generated_at: 'x', paused, resources: entries},
    etag: '"e"',
  };
}

function active(version: number, bytes = 1000) {
  return {
    key: KEY,
    kind: 'tafsir' as const,
    source: 'qf',
    version,
    status: 'active' as const,
    upstream_schema_version: 1,
    bytes,
    sha256: `sha-v${version}`,
    meta: {name: 'Ibn Kathir'},
  };
}

function setup(result: ManifestResult) {
  const registry = createMemoryContentRegistry();
  const installer: jest.Mocked<ContentInstaller> = {
    kind: 'tafsir',
    supportsSchemaVersion: jest.fn((v: number) => v === 1),
    install: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    onWithdrawn: jest.fn().mockResolvedValue(undefined),
  };
  let served = 2;
  const api: jest.Mocked<ContentApi> = {
    fetchManifest: jest.fn().mockResolvedValue(result),
    getDownloadTicket: jest.fn(async (_key: string) => ({
      url: 'u',
      version: served,
      sha256: `sha-v${served}`,
      bytes: 1000,
      expires_at: 'x',
    })),
    fetchText: jest.fn(async (_url: string) =>
      JSON.stringify(envelope(served)),
    ),
  };
  let now = 1_000_000_000_000;
  const deps: EngineDeps = {
    api,
    registry,
    installers: {tafsir: installer},
    isOnWifi: jest.fn().mockResolvedValue(true),
    sha256: jest.fn(
      async (text: string) =>
        `sha-v${(JSON.parse(text) as ContentEnvelope).version}`,
    ),
    now: () => now,
    notify: jest.fn(),
    track: jest.fn(),
  };
  return {
    deps,
    registry,
    installer,
    api,
    setServed: (v: number) => {
      served = v;
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('runContentCheck', () => {
  it('updates an installed resource to a newer version', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
    expect(await runContentCheck(deps)).toBe('applied');
    expect(installer.install).toHaveBeenCalledTimes(1);
    expect((await registry.get(KEY))?.version).toBe(2);
    expect(deps.track).toHaveBeenCalledWith('applied', {key: KEY, version: 2});
  });

  it('does nothing when versions match, and skips within 24 hours', async () => {
    const {deps, registry, installer, api, advance} = setup(
      manifest([active(2)]),
    );
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 2});
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
    advance(60_000);
    expect(await runContentCheck(deps)).toBe('skipped_recent');
    expect(api.fetchManifest).toHaveBeenCalledTimes(1);
  });

  it('purges a withdrawn or missing resource, falls back and notifies once', async () => {
    const {deps, registry, installer} = setup(
      manifest([
        {
          key: KEY,
          kind: 'tafsir',
          source: 'qf',
          version: 2,
          status: 'withdrawn',
          withdrawn_reason: 'copyright_holder_request',
        },
      ]),
    );
    await registry.upsert({
      ...emptyRow(KEY, 'tafsir'),
      version: 1,
      name: 'Ibn Kathir',
    });
    await registry.upsert({
      ...emptyRow('qf:tafsirs:5', 'tafsir'),
      version: 1,
      name: 'Gone',
    });
    await runContentCheck(deps);
    expect(installer.remove).toHaveBeenCalledWith(KEY);
    expect(installer.remove).toHaveBeenCalledWith('qf:tafsirs:5');
    expect(installer.onWithdrawn).toHaveBeenCalledTimes(2);
    expect(deps.notify).toHaveBeenCalledWith({key: KEY, name: 'Ibn Kathir'});
    expect(await registry.list()).toEqual([]);
  });

  it('never purges on error, 304, malformed manifest, or pause', async () => {
    for (const result of [
      {status: 'error', reason: 'network'} as ManifestResult,
      {status: 'error', reason: 'malformed'} as ManifestResult,
      {status: 'not_modified'} as ManifestResult,
      manifest([], true),
    ]) {
      const {deps, registry, installer} = setup(result);
      await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
      await runContentCheck(deps, {force: true});
      expect(installer.remove).not.toHaveBeenCalled();
      expect(installer.onWithdrawn).not.toHaveBeenCalled();
      expect(installer.install).not.toHaveBeenCalled();
      expect(deps.notify).not.toHaveBeenCalled();
      expect(await registry.get(KEY)).not.toBeNull();
    }
  });

  it('reports the outcome and state changes for error, 304 and pause', async () => {
    const error = setup({status: 'error', reason: 'network'});
    expect(await runContentCheck(error.deps)).toBe('error');
    expect(await error.registry.getState()).toMatchObject({
      lastCheckedAt: null,
      manifestEtag: null,
    });

    const notModified = setup({status: 'not_modified'});
    expect(await runContentCheck(notModified.deps)).toBe('not_modified');
    expect((await notModified.registry.getState()).lastCheckedAt).toBe(
      notModified.deps.now(),
    );

    const paused = setup(manifest([], true));
    expect(await runContentCheck(paused.deps)).toBe('paused');
    expect(await paused.registry.getState()).toMatchObject({
      manifestEtag: '"e"',
      lastCheckedAt: paused.deps.now(),
    });
  });

  it('passes the stored ETag and only the managed kinds', async () => {
    const {deps, registry, api} = setup({status: 'not_modified'});
    await registry.setState({manifestEtag: '"prev"'});
    await runContentCheck(deps);
    expect(api.fetchManifest).toHaveBeenCalledWith(['tafsir'], '"prev"');
  });

  it('honors an explicit empty resource list from a valid manifest', async () => {
    const {deps, registry, installer} = setup(manifest([]));
    await registry.upsert({
      ...emptyRow(KEY, 'tafsir'),
      version: 1,
      name: 'Ibn Kathir',
    });
    expect(await runContentCheck(deps)).toBe('applied');
    expect(installer.remove).toHaveBeenCalledWith(KEY);
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(deps.track).toHaveBeenCalledWith('withdrawn', {
      key: KEY,
      version: 1,
      reason: 'absent',
    });
    expect(await registry.get(KEY)).toBeNull();
  });

  it('keeps the current copy when the schema is unsupported', async () => {
    const {deps, registry, installer} = setup(
      manifest([{...active(2), upstream_schema_version: 2}]),
    );
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
    expect((await registry.get(KEY))?.version).toBe(1);
  });

  it('waits for Wi-Fi for large updates', async () => {
    const {deps, registry, installer} = setup(manifest([active(2, 6_000_000)]));
    (deps.isOnWifi as jest.Mock).mockResolvedValue(false);
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
  });

  it('replaces legacy rows even at the same version', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({
      ...emptyRow(KEY, 'tafsir'),
      version: 0,
      legacy: true,
    });
    await runContentCheck(deps);
    expect(installer.install).toHaveBeenCalled();
    expect((await registry.get(KEY))?.legacy).toBe(false);
  });

  it('leaves user-removed markers alone', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), user_removed: true});
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
    expect(installer.remove).not.toHaveBeenCalled();
  });
});

describe('installResource', () => {
  it('rejects a sha mismatch without installing and backs off', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    (deps.sha256 as jest.Mock).mockResolvedValue('wrong');
    await expect(installResource(deps, KEY, 'tafsir', 'user')).rejects.toThrow(
      'sha_mismatch',
    );
    expect(installer.install).not.toHaveBeenCalled();
    const row = await registry.get(KEY);
    expect(row?.failures).toBe(1);
    expect(row?.next_retry_at).toBe(deps.now() + BACKOFF_MS[0]);
  });

  it('backs off 1h, 6h, then caps at 24h on repeated failures', async () => {
    const {deps, registry} = setup(manifest([active(2)]));
    (deps.sha256 as jest.Mock).mockResolvedValue('wrong');
    const expected = [3_600_000, 21_600_000, 86_400_000, 86_400_000];
    for (const [index, delay] of expected.entries()) {
      await installResource(deps, KEY, 'tafsir', 'auto');
      const row = await registry.get(KEY);
      expect(row?.failures).toBe(index + 1);
      expect(row?.next_retry_at).toBe(deps.now() + delay);
    }
    expect(deps.track).toHaveBeenCalledWith('failed', {
      key: KEY,
      version: 0,
      reason: 'sha_mismatch',
    });
  });

  it('keeps the registry version when the installer fails mid-install', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({
      ...emptyRow(KEY, 'tafsir'),
      version: 1,
      sha256: 'sha-v1',
    });
    installer.install.mockRejectedValueOnce(new Error('disk full'));
    await installResource(deps, KEY, 'tafsir', 'auto');
    const row = await registry.get(KEY);
    expect(row?.version).toBe(1);
    expect(row?.sha256).toBe('sha-v1');
    expect(row?.failures).toBe(1);
    expect(deps.track).toHaveBeenCalledWith('failed', {
      key: KEY,
      version: 1,
      reason: 'disk full',
    });
    expect(deps.track).not.toHaveBeenCalledWith('applied', expect.anything());
  });

  it('rejects an envelope for a different key', async () => {
    const {deps, installer, api} = setup(manifest([active(2)]));
    api.fetchText.mockResolvedValue(
      JSON.stringify({...envelope(2), key: 'qf:tafsirs:1'}),
    );
    await expect(installResource(deps, KEY, 'tafsir', 'user')).rejects.toThrow(
      'envelope_mismatch',
    );
    expect(installer.install).not.toHaveBeenCalled();
  });

  it('respects backoff on the next check', async () => {
    const {deps, registry, installer, advance} = setup(manifest([active(2)]));
    await registry.upsert({
      ...emptyRow(KEY, 'tafsir'),
      version: 1,
      failures: 1,
      next_retry_at: deps.now() + BACKOFF_MS[0],
    });
    await runContentCheck(deps, {force: true});
    expect(installer.install).not.toHaveBeenCalled();
    advance(BACKOFF_MS[0] + 1);
    await runContentCheck(deps, {force: true});
    expect(installer.install).toHaveBeenCalled();
  });
});

describe('removeResource', () => {
  it('removes data and keeps a user_removed marker', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 2});
    await removeResource(deps, KEY);
    expect(installer.remove).toHaveBeenCalledWith(KEY);
    expect(await registry.get(KEY)).toMatchObject({
      user_removed: true,
      version: 0,
    });
  });
});
