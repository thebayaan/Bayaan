import fs from 'fs';
import path from 'path';
import {isManifest, type ContentApi} from '../contentApi';
import {createMemoryContentRegistry, emptyRow} from '../contentRegistry';
import {runContentCheck, type EngineDeps} from '../contentEngine';
import type {ContentInstaller, ContentKind, Manifest} from '@/types/content';

const fixtureDir = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'contracts',
  'content',
  'v1',
);

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixtureDir, name), 'utf8');
}

function loadManifest(name: string): Manifest {
  const parsed: unknown = JSON.parse(readFixture(name));
  if (!isManifest(parsed)) throw new Error(`fixture ${name} is not a manifest`);
  return parsed;
}

const ENVELOPES: Record<string, string> = {
  'qf:tafsirs:169': readFixture('envelope-tafsir.json'),
  'qf:translations:20': readFixture('envelope-translation.json'),
};

function fakeInstaller(kind: ContentKind): jest.Mocked<ContentInstaller> {
  return {
    kind,
    supportsSchemaVersion: jest.fn((v: number) => v === 1),
    install: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    onWithdrawn: jest.fn().mockResolvedValue(undefined),
  };
}

function setup(manifest: Manifest) {
  const registry = createMemoryContentRegistry();
  const installers = {
    tafsir: fakeInstaller('tafsir'),
    translation: fakeInstaller('translation'),
  };
  const shaByText = new Map<string, string>();
  for (const entry of manifest.resources) {
    const text = ENVELOPES[entry.key];
    if (text && entry.sha256) shaByText.set(text, entry.sha256);
  }
  const api: ContentApi = {
    fetchManifest: jest.fn(async () => ({
      status: 'ok' as const,
      manifest,
      etag: '"contract"',
    })),
    async getDownloadTicket(key) {
      const entry = manifest.resources.find(candidate => candidate.key === key);
      if (!entry || entry.status !== 'active' || !entry.sha256)
        throw new Error('download_ticket_404');
      return {
        url: key,
        version: entry.version,
        sha256: entry.sha256,
        bytes: entry.bytes ?? 0,
        expires_at: 'x',
      };
    },
    async fetchText(url) {
      const text = ENVELOPES[url];
      if (!text) throw new Error('download_404');
      return text;
    },
  };
  const deps: EngineDeps = {
    api,
    registry,
    installers,
    isOnWifi: async () => true,
    sha256: async text => shaByText.get(text) ?? 'unknown',
    now: () => 1_000_000_000_000,
    notify: jest.fn(),
    track: jest.fn(),
  };
  return {deps, registry, installers};
}

describe('content engine against backend contract fixtures', () => {
  it('installs every resource listed in the active manifest', async () => {
    const manifest = loadManifest('manifest.json');
    const {deps, registry, installers} = setup(manifest);
    for (const entry of manifest.resources) {
      await registry.upsert({...emptyRow(entry.key, entry.kind), legacy: true});
    }
    expect(await runContentCheck(deps)).toBe('applied');
    expect(installers.tafsir.install).toHaveBeenCalledWith(
      'qf:tafsirs:169',
      expect.objectContaining({key: 'qf:tafsirs:169'}),
      undefined,
    );
    expect(installers.translation.install).toHaveBeenCalledWith(
      'qf:translations:20',
      expect.objectContaining({key: 'qf:translations:20'}),
      undefined,
    );
    for (const entry of manifest.resources) {
      expect(await registry.get(entry.key)).toMatchObject({
        version: entry.version,
        sha256: entry.sha256,
        legacy: false,
        failures: 0,
        name: entry.meta?.name,
      });
    }
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('removes withdrawn resources with exactly one notice per key', async () => {
    const manifest = loadManifest('manifest-withdrawn.json');
    const withdrawn = manifest.resources.filter(
      entry => entry.status === 'withdrawn',
    );
    expect(withdrawn.length).toBeGreaterThan(0);
    const {deps, registry, installers} = setup(manifest);
    for (const entry of manifest.resources) {
      await registry.upsert({
        ...emptyRow(entry.key, entry.kind),
        version: entry.version,
        sha256: entry.sha256 ?? null,
        name: `Local ${entry.key}`,
      });
    }
    expect(await runContentCheck(deps)).toBe('applied');
    expect(deps.notify).toHaveBeenCalledTimes(withdrawn.length);
    for (const entry of withdrawn) {
      expect(deps.notify).toHaveBeenCalledWith({
        key: entry.key,
        name: `Local ${entry.key}`,
      });
      expect(installers[entry.kind].remove).toHaveBeenCalledWith(entry.key);
      expect(installers[entry.kind].onWithdrawn).toHaveBeenCalledWith(
        entry.key,
      );
      expect(await registry.get(entry.key)).toBeNull();
    }
    for (const entry of manifest.resources.filter(
      candidate => candidate.status === 'active',
    )) {
      expect(installers[entry.kind].remove).not.toHaveBeenCalledWith(entry.key);
      expect(await registry.get(entry.key)).toMatchObject({
        version: entry.version,
      });
    }
    expect(installers.tafsir.install).not.toHaveBeenCalled();
    expect(installers.translation.install).not.toHaveBeenCalled();
  });

  it('a second check after withdrawal sends no further notices', async () => {
    const manifest = loadManifest('manifest-withdrawn.json');
    const {deps, registry} = setup(manifest);
    for (const entry of manifest.resources) {
      await registry.upsert({
        ...emptyRow(entry.key, entry.kind),
        version: entry.version,
      });
    }
    await runContentCheck(deps);
    await runContentCheck(deps, {force: true});
    const withdrawnCount = manifest.resources.filter(
      entry => entry.status === 'withdrawn',
    ).length;
    expect(deps.notify).toHaveBeenCalledTimes(withdrawnCount);
  });
});
