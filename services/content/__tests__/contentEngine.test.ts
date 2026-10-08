import {createMemoryContentRegistry, emptyRow} from '../contentRegistry';
import {
  BACKOFF_MS,
  DAY_MS,
  WIFI_THRESHOLD_BYTES,
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

describe('runContentCheck per-row isolation', () => {
  const A = 'qf:tafsirs:1';
  const C = 'qf:tafsirs:5';

  it('a throwing remove on one row still updates and removes the others, and retries later', async () => {
    const {deps, registry, installer} = setup(
      manifest([
        {key: A, kind: 'tafsir', source: 'qf', version: 1, status: 'withdrawn'},
        active(2),
      ]),
    );
    await registry.upsert({...emptyRow(A, 'tafsir'), version: 1, name: 'A'});
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
    await registry.upsert({...emptyRow(C, 'tafsir'), version: 1, name: 'C'});
    installer.remove.mockImplementation(async (key: string) => {
      if (key === A) throw new Error('remove failed');
    });

    expect(await runContentCheck(deps)).toBe('applied');
    expect((await registry.get(KEY))?.version).toBe(2);
    expect(await registry.get(C)).toBeNull();
    expect(deps.notify).toHaveBeenCalledWith({key: C, name: 'C'});
    expect(deps.notify).not.toHaveBeenCalledWith({key: A, name: 'A'});
    expect(await registry.get(A)).toMatchObject({
      version: 1,
      failures: 1,
      next_retry_at: deps.now() + BACKOFF_MS[0],
    });
    expect(deps.track).toHaveBeenCalledWith('failed', {
      key: A,
      version: 1,
      reason: 'remove failed',
    });

    installer.remove.mockResolvedValue(undefined);
    await runContentCheck(deps, {force: true});
    expect(await registry.get(A)).toBeNull();
    expect(deps.notify).toHaveBeenCalledWith({key: A, name: 'A'});
  });

  it('a throwing isOnWifi does not abort the check', async () => {
    const LARGE = 'qf:tafsirs:7';
    const {deps, registry, installer} = setup(
      manifest([{...active(2, 6_000_000), key: LARGE}, active(2)]),
    );
    (deps.isOnWifi as jest.Mock).mockRejectedValue(new Error('netinfo'));
    await registry.upsert({...emptyRow(LARGE, 'tafsir'), version: 1});
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
    await registry.upsert({...emptyRow(C, 'tafsir'), version: 1});

    expect(await runContentCheck(deps)).toBe('applied');
    expect((await registry.get(KEY))?.version).toBe(2);
    expect(await registry.get(C)).toBeNull();
    expect(installer.install).toHaveBeenCalledTimes(1);
    expect(await registry.get(LARGE)).toMatchObject({
      version: 1,
      failures: 1,
      next_retry_at: deps.now() + BACKOFF_MS[0],
    });
  });
});

describe('runContentCheck never-installed placeholders', () => {
  function placeholder() {
    return {
      ...emptyRow(KEY, 'tafsir'),
      failures: 1,
      next_retry_at: 1,
      name: 'Ibn Kathir',
    };
  }

  it('deletes a withdrawn placeholder silently', async () => {
    const {deps, registry, installer} = setup(
      manifest([
        {
          key: KEY,
          kind: 'tafsir',
          source: 'qf',
          version: 2,
          status: 'withdrawn',
        },
      ]),
    );
    await registry.upsert(placeholder());
    await runContentCheck(deps);
    expect(await registry.get(KEY)).toBeNull();
    expect(deps.notify).not.toHaveBeenCalled();
    expect(installer.remove).not.toHaveBeenCalled();
    expect(installer.onWithdrawn).not.toHaveBeenCalled();
    expect(deps.track).not.toHaveBeenCalledWith('withdrawn', expect.anything());
  });

  it('deletes an absent placeholder silently', async () => {
    const {deps, registry, installer} = setup(manifest([]));
    await registry.upsert(placeholder());
    await runContentCheck(deps);
    expect(await registry.get(KEY)).toBeNull();
    expect(deps.notify).not.toHaveBeenCalled();
    expect(installer.remove).not.toHaveBeenCalled();
    expect(installer.onWithdrawn).not.toHaveBeenCalled();
  });

  it('still removes and notifies for a withdrawn legacy copy at version 0', async () => {
    const {deps, registry, installer} = setup(manifest([]));
    await registry.upsert({
      ...emptyRow(KEY, 'tafsir'),
      legacy: true,
      name: 'Ibn Kathir',
    });
    await runContentCheck(deps);
    expect(installer.remove).toHaveBeenCalledWith(KEY);
    expect(deps.notify).toHaveBeenCalledWith({key: KEY, name: 'Ibn Kathir'});
  });

  it('sends no second notice on a later check after a withdrawal', async () => {
    const {deps, registry} = setup(
      manifest([
        {
          key: KEY,
          kind: 'tafsir',
          source: 'qf',
          version: 2,
          status: 'withdrawn',
        },
      ]),
    );
    await registry.upsert({
      ...emptyRow(KEY, 'tafsir'),
      version: 1,
      name: 'Ibn Kathir',
    });
    await runContentCheck(deps);
    await runContentCheck(deps, {force: true});
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });
});

function withdrawnEntry(): Manifest['resources'][number] {
  return {
    key: KEY,
    kind: 'tafsir',
    source: 'qf',
    version: 2,
    status: 'withdrawn',
    withdrawn_reason: 'copyright_holder_request',
  };
}

function installedRow(version: number) {
  return {
    ...emptyRow(KEY, 'tafsir'),
    version,
    sha256: `sha-v${version}`,
    upstream_schema_version: 1,
    installed_at: 1,
    name: 'Ibn Kathir',
  };
}

describe('runContentCheck cadence', () => {
  it('pins the constants', () => {
    expect(DAY_MS).toBe(86_400_000);
    expect(WIFI_THRESHOLD_BYTES).toBe(5_000_000);
  });

  it('skips at DAY_MS - 1 and checks and applies at DAY_MS', async () => {
    const {deps, registry, api, installer, setServed, advance} = setup(
      manifest([active(2)]),
    );
    await registry.upsert(installedRow(2));
    expect(await runContentCheck(deps)).toBe('applied');
    api.fetchManifest.mockResolvedValue(manifest([active(3)]));
    setServed(3);
    advance(DAY_MS - 1);
    expect(await runContentCheck(deps)).toBe('skipped_recent');
    expect(api.fetchManifest).toHaveBeenCalledTimes(1);
    advance(1);
    expect(await runContentCheck(deps)).toBe('applied');
    expect(api.fetchManifest).toHaveBeenCalledTimes(2);
    expect(installer.install).toHaveBeenCalledTimes(1);
    expect((await registry.get(KEY))?.version).toBe(3);
  });

  it('always checks after 7 days', async () => {
    const {deps, registry, api, advance} = setup(manifest([active(2)]));
    await registry.upsert(installedRow(2));
    await runContentCheck(deps);
    advance(7 * DAY_MS);
    expect(await runContentCheck(deps)).toBe('applied');
    expect(api.fetchManifest).toHaveBeenCalledTimes(2);
  });

  it('treats a lastCheckedAt in the future as stale (clock moved back)', async () => {
    const {deps, registry, api} = setup(manifest([active(2)]));
    await registry.setState({lastCheckedAt: deps.now() + 2 * DAY_MS});
    expect(await runContentCheck(deps)).toBe('applied');
    expect(api.fetchManifest).toHaveBeenCalledTimes(1);
  });

  it('treats a next_retry_at beyond the longest backoff as elapsed', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({
      ...installedRow(1),
      failures: 3,
      next_retry_at: deps.now() + 10 * DAY_MS,
    });
    await runContentCheck(deps);
    expect(installer.install).toHaveBeenCalledTimes(1);
  });

  it('still honors a next_retry_at within the longest backoff', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({
      ...installedRow(1),
      failures: 3,
      next_retry_at: deps.now() + BACKOFF_MS[2],
    });
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
  });
});

describe('runContentCheck Wi-Fi gate', () => {
  it('installs a large update on Wi-Fi', async () => {
    const {deps, registry, installer} = setup(manifest([active(2, 6_000_000)]));
    await registry.upsert(installedRow(1));
    await runContentCheck(deps);
    expect(installer.install).toHaveBeenCalledTimes(1);
  });

  it('installs exactly 5,000,000 bytes off Wi-Fi', async () => {
    const {deps, registry, installer} = setup(manifest([active(2, 5_000_000)]));
    (deps.isOnWifi as jest.Mock).mockResolvedValue(false);
    await registry.upsert(installedRow(1));
    await runContentCheck(deps);
    expect(installer.install).toHaveBeenCalledTimes(1);
  });

  it('waits for Wi-Fi at 5,000,001 bytes', async () => {
    const {deps, registry, installer} = setup(manifest([active(2, 5_000_001)]));
    (deps.isOnWifi as jest.Mock).mockResolvedValue(false);
    await registry.upsert(installedRow(1));
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
    expect((await registry.get(KEY))?.version).toBe(1);
  });

  it('purges a withdrawn row while off Wi-Fi', async () => {
    const {deps, registry, installer} = setup(manifest([withdrawnEntry()]));
    (deps.isOnWifi as jest.Mock).mockResolvedValue(false);
    await registry.upsert(installedRow(1));
    await runContentCheck(deps);
    expect(installer.remove).toHaveBeenCalledWith(KEY);
    expect(await registry.get(KEY)).toBeNull();
  });
});

describe('runContentCheck purge hardening', () => {
  it('marks the row not installed when onWithdrawn fails after remove, then finishes later', async () => {
    const {deps, registry, installer} = setup(manifest([withdrawnEntry()]));
    await registry.upsert(installedRow(1));
    installer.onWithdrawn.mockRejectedValueOnce(new Error('fallback failed'));
    await runContentCheck(deps);
    expect(await registry.get(KEY)).toMatchObject({
      version: 0,
      sha256: null,
      installed_at: null,
      failures: 1,
    });
    expect(deps.notify).not.toHaveBeenCalled();

    await runContentCheck(deps, {force: true});
    expect(installer.onWithdrawn).toHaveBeenCalledTimes(2);
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(await registry.get(KEY)).toBeNull();
  });

  it('reinstalls when a half-purged resource is reinstated at the same version', async () => {
    const {deps, registry, installer, api, setServed} = setup(
      manifest([withdrawnEntry()]),
    );
    await registry.upsert(installedRow(2));
    installer.onWithdrawn.mockRejectedValueOnce(new Error('fallback failed'));
    await runContentCheck(deps);
    api.fetchManifest.mockResolvedValue(manifest([active(2)]));
    setServed(2);
    const halfPurged = await registry.get(KEY);
    if (!halfPurged) throw new Error('expected a half-purged row');
    await registry.upsert({...halfPurged, next_retry_at: null});
    await runContentCheck(deps, {force: true});
    expect(installer.install).toHaveBeenCalledTimes(1);
    expect((await registry.get(KEY))?.version).toBe(2);
  });

  it('does not repeat the notice when the final delete fails', async () => {
    const {deps, registry, installer} = setup(manifest([withdrawnEntry()]));
    await registry.upsert(installedRow(1));
    const realDelete = registry.delete.bind(registry);
    let failDelete = true;
    registry.delete = async (key: string) => {
      if (failDelete) throw new Error('delete failed');
      await realDelete(key);
    };
    await runContentCheck(deps);
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(await registry.get(KEY)).toMatchObject({
      withdrawal_notified: true,
      version: 0,
    });

    failDelete = false;
    await runContentCheck(deps, {force: true});
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(installer.remove).toHaveBeenCalledTimes(2);
    expect(await registry.get(KEY)).toBeNull();
  });

  it('skips the notice for a row already marked notified', async () => {
    const {deps, registry, installer} = setup(manifest([withdrawnEntry()]));
    await registry.upsert({...installedRow(1), withdrawal_notified: true});
    await runContentCheck(deps);
    expect(installer.remove).toHaveBeenCalledWith(KEY);
    expect(deps.notify).not.toHaveBeenCalled();
    expect(await registry.get(KEY)).toBeNull();
  });

  it('does not auto-reinstall a resource that reappears after withdrawal', async () => {
    const {deps, registry, installer, api} = setup(
      manifest([withdrawnEntry()]),
    );
    await registry.upsert(installedRow(1));
    await runContentCheck(deps);
    expect(await registry.get(KEY)).toBeNull();
    api.fetchManifest.mockResolvedValue(manifest([active(2)]));
    await runContentCheck(deps, {force: true});
    expect(installer.install).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(await registry.get(KEY)).toBeNull();
  });
});

describe('runContentCheck schema version', () => {
  it('treats a missing upstream_schema_version as unsupported', async () => {
    const entry: Manifest['resources'][number] = {...active(2)};
    delete entry.upstream_schema_version;
    const {deps, registry, installer, api} = setup(manifest([entry]));
    await registry.upsert(installedRow(1));
    await runContentCheck(deps);
    expect(api.getDownloadTicket).not.toHaveBeenCalled();
    expect(installer.install).not.toHaveBeenCalled();
    expect(installer.remove).not.toHaveBeenCalled();
    expect(await registry.get(KEY)).toMatchObject({version: 1, failures: 0});
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

  it('rejects an envelope whose envelope format is not 1', async () => {
    const {deps, installer, api} = setup(manifest([active(2)]));
    api.fetchText.mockResolvedValue(
      JSON.stringify({...envelope(2), envelope: 2}),
    );
    await expect(installResource(deps, KEY, 'tafsir', 'user')).rejects.toThrow(
      'envelope_mismatch',
    );
    expect(installer.install).not.toHaveBeenCalled();
  });

  it('rejects a ticket whose version differs from the envelope', async () => {
    const {deps, registry, installer, api} = setup(manifest([active(2)]));
    await registry.upsert(installedRow(1));
    api.fetchText.mockResolvedValue(JSON.stringify(envelope(3)));
    (deps.sha256 as jest.Mock).mockResolvedValue('sha-v2');
    await installResource(deps, KEY, 'tafsir', 'auto');
    expect(installer.install).not.toHaveBeenCalled();
    expect(await registry.get(KEY)).toMatchObject({
      version: 1,
      sha256: 'sha-v1',
      failures: 1,
      next_retry_at: deps.now() + BACKOFF_MS[0],
    });
    expect(deps.track).toHaveBeenCalledWith('failed', {
      key: KEY,
      version: 1,
      reason: 'version_mismatch',
    });
  });

  it('rejects a ticket whose version differs from the manifest entry', async () => {
    const {deps, registry, installer, setServed} = setup(manifest([active(3)]));
    await registry.upsert(installedRow(1));
    setServed(2);
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
    expect(await registry.get(KEY)).toMatchObject({
      version: 1,
      failures: 1,
      next_retry_at: deps.now() + BACKOFF_MS[0],
    });
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
