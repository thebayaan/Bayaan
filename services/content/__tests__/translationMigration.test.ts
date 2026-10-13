const mockToast = jest.fn();
jest.mock('burnt', () => ({toast: (...args: unknown[]) => mockToast(...args)}));

import type {DownloadedTranslationMeta} from '@/types/translation';
import type {EngineDeps} from '../contentEngine';
import {
  removedTranslationsMessage,
  showRemovedTranslationsNotice,
  translationDownloadFailure,
} from '../contentNotices';
import {
  createMemoryContentRegistry,
  emptyRow,
  type ContentRegistry,
} from '../contentRegistry';
import {
  maybeAutoInstallTranslation,
  migrateLegacyTranslations,
  SAHEEH_KEY,
  type TranslationMigrationDeps,
} from '../translationMigration';

function meta(
  identifier: string,
  englishName: string,
): DownloadedTranslationMeta {
  return {
    identifier,
    name: englishName,
    englishName,
    language: 'en',
    direction: 'ltr',
    downloadedAt: 1,
    verseCount: 6236,
  };
}

// translations.db as identifiers; rename and delete act on it.
function setup(downloaded: string[], selected = 'clear-quran') {
  const rows = new Map(downloaded.map(id => [id, meta(id, `Name ${id}`)]));
  const settings = {selectedTranslationId: selected};
  const registry = createMemoryContentRegistry();
  const db = {
    getDownloadedTranslations: jest.fn(async () => [...rows.values()]),
    renameTranslation: jest.fn(async (from: string, to: string) => {
      const row = rows.get(from);
      if (!row) return;
      rows.delete(from);
      rows.set(to, {...row, identifier: to});
    }),
    deleteTranslation: jest.fn(async (id: string) => {
      rows.delete(id);
    }),
  };
  const notifyRemoved = jest.fn();
  const reload = jest.fn(async () => undefined);
  const deps: TranslationMigrationDeps = {
    registry,
    db,
    settings: {
      getState: () => ({
        selectedTranslationId: settings.selectedTranslationId,
        setSelectedTranslationId: (id: string) => {
          settings.selectedTranslationId = id;
        },
      }),
    },
    notifyRemoved,
    reload,
    now: 5000,
  };
  return {deps, rows, settings, registry, db, notifyRemoved, reload};
}

describe('migrateLegacyTranslations', () => {
  it('renames a matched edition in place and registers it as legacy version 0', async () => {
    const s = setup(['en.pickthall']);
    expect(await migrateLegacyTranslations(s.deps)).toBe(true);
    expect(s.db.renameTranslation).toHaveBeenCalledWith('en.pickthall', '19');
    expect([...s.rows.keys()]).toEqual(['19']);
    expect(await s.registry.get('qf:translations:19')).toMatchObject({
      kind: 'translation',
      version: 0,
      legacy: true,
      user_removed: false,
      name: 'Name en.pickthall',
    });
    expect(s.notifyRemoved).not.toHaveBeenCalled();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it('deletes unmatched editions and names them in one notice', async () => {
    const s = setup(['en.itani', 'en.pickthall', 'fa.makarem']);
    await migrateLegacyTranslations(s.deps);
    expect(s.db.deleteTranslation).toHaveBeenCalledWith('en.itani');
    expect(s.db.deleteTranslation).toHaveBeenCalledWith('fa.makarem');
    expect([...s.rows.keys()]).toEqual(['19']);
    expect(s.notifyRemoved).toHaveBeenCalledTimes(1);
    expect(s.notifyRemoved).toHaveBeenCalledWith([
      'Name en.itani',
      'Name fa.makarem',
    ]);
    expect(await s.registry.get('qf:translations:en.itani')).toBeNull();
  });

  it('sets the flag once; a rerun touches nothing', async () => {
    const s = setup(['en.itani']);
    await migrateLegacyTranslations(s.deps);
    expect((await s.registry.getState()).translationsMigratedAt).toBe(5000);
    s.rows.set('en.asad', meta('en.asad', 'Asad'));
    expect(await migrateLegacyTranslations({...s.deps, now: 9000})).toBe(false);
    expect(s.db.getDownloadedTranslations).toHaveBeenCalledTimes(1);
    expect(s.db.deleteTranslation).toHaveBeenCalledTimes(1);
    expect(s.notifyRemoved).toHaveBeenCalledTimes(1);
    expect((await s.registry.getState()).translationsMigratedAt).toBe(5000);
  });

  it('keeps one copy when two editions share a QF text, without a notice', async () => {
    const s = setup(['zh.jian', 'zh.majian']);
    await migrateLegacyTranslations(s.deps);
    expect(s.db.renameTranslation).toHaveBeenCalledTimes(1);
    expect(s.db.deleteTranslation).toHaveBeenCalledTimes(1);
    expect([...s.rows.keys()]).toEqual(['56']);
    expect(s.notifyRemoved).not.toHaveBeenCalled();
  });

  it('drops a legacy copy when its QF edition is already installed', async () => {
    const s = setup(['19', 'en.pickthall']);
    await s.registry.upsert({
      ...emptyRow('qf:translations:19', 'translation'),
      version: 4,
    });
    await migrateLegacyTranslations(s.deps);
    expect(s.db.renameTranslation).not.toHaveBeenCalled();
    expect(s.db.deleteTranslation).toHaveBeenCalledWith('en.pickthall');
    // The engine's own row is left as it was.
    expect(await s.registry.get('qf:translations:19')).toMatchObject({
      version: 4,
      legacy: false,
    });
  });

  it('after a kill between rename and registry write, adopts the renamed rows', async () => {
    const s = setup(['19']);
    await migrateLegacyTranslations(s.deps);
    expect(await s.registry.get('qf:translations:19')).toMatchObject({
      legacy: true,
      version: 0,
    });
  });

  it.each([
    ['en.pickthall', '19'],
    ['en.asad', 'clear-quran'],
    ['clear-quran', 'clear-quran'],
    ['20', '20'],
  ])('remaps the selection %s to %s', async (selected, expected) => {
    const s = setup([], selected);
    await migrateLegacyTranslations(s.deps);
    expect(s.settings.selectedTranslationId).toBe(expected);
    expect((await s.registry.getState()).translationAutoInstallKey).toBeNull();
  });

  it('moves a saheeh selection to 20 and queues its install', async () => {
    const s = setup([], 'saheeh');
    await migrateLegacyTranslations(s.deps);
    expect(s.settings.selectedTranslationId).toBe('20');
    expect((await s.registry.getState()).translationAutoInstallKey).toBe(
      SAHEEH_KEY,
    );
  });
});

describe('maybeAutoInstallTranslation', () => {
  function engine(registry: ContentRegistry, now = 1000) {
    const installer = {
      kind: 'translation' as const,
      supportsSchemaVersion: () => true,
      install: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      onWithdrawn: jest.fn().mockResolvedValue(undefined),
    };
    const api = {
      fetchManifest: jest.fn(),
      getDownloadTicket: jest.fn(async () => ({
        url: 'u',
        version: 2,
        sha256: 's',
        bytes: 1,
        expires_at: 'x',
      })),
      fetchText: jest.fn(async () =>
        JSON.stringify({
          envelope: 1,
          key: SAHEEH_KEY,
          version: 2,
          source: 'qf',
          fetched_at: 'x',
          snapshot: {
            resource_group: 'translations',
            resource_id: 20,
            schema_version: 1,
            records: [],
          },
        }),
      ),
    };
    const deps: EngineDeps = {
      api,
      registry,
      installers: {translation: installer},
      isOnWifi: jest.fn().mockResolvedValue(false),
      sha256: async () => 's',
      now: () => now,
      notify: jest.fn(),
      track: jest.fn(),
    };
    return {deps, installer, api};
  }

  it('does nothing when no install is queued', async () => {
    const registry = createMemoryContentRegistry();
    const {deps, api} = engine(registry);
    expect(await maybeAutoInstallTranslation(deps)).toBe(false);
    expect(api.getDownloadTicket).not.toHaveBeenCalled();
  });

  it('installs the queued key over any network, then clears it', async () => {
    const registry = createMemoryContentRegistry();
    await registry.setState({translationAutoInstallKey: SAHEEH_KEY});
    const {deps, installer} = engine(registry);
    expect(await maybeAutoInstallTranslation(deps)).toBe(true);
    expect(installer.install).toHaveBeenCalledTimes(1);
    expect(deps.isOnWifi).not.toHaveBeenCalled();
    expect((await registry.getState()).translationAutoInstallKey).toBeNull();
    expect((await registry.get(SAHEEH_KEY))?.version).toBe(2);
  });

  it('a user removal settles it for good', async () => {
    const registry = createMemoryContentRegistry();
    await registry.setState({translationAutoInstallKey: SAHEEH_KEY});
    await registry.upsert({
      ...emptyRow(SAHEEH_KEY, 'translation'),
      user_removed: true,
    });
    const {deps, api} = engine(registry);
    expect(await maybeAutoInstallTranslation(deps)).toBe(false);
    expect(api.getDownloadTicket).not.toHaveBeenCalled();
    expect((await registry.getState()).translationAutoInstallKey).toBeNull();
  });

  it('waits out the backoff after a failure, keeping the key queued', async () => {
    const registry = createMemoryContentRegistry();
    await registry.setState({translationAutoInstallKey: SAHEEH_KEY});
    const {deps, api} = engine(registry);
    api.getDownloadTicket.mockRejectedValueOnce(new Error('offline'));
    expect(await maybeAutoInstallTranslation(deps)).toBe(false);
    expect((await registry.getState()).translationAutoInstallKey).toBe(
      SAHEEH_KEY,
    );
    expect(await maybeAutoInstallTranslation(deps)).toBe(false);
    expect(api.getDownloadTicket).toHaveBeenCalledTimes(1);
  });
});

describe('removed translations notice', () => {
  it('names every removed edition in one toast', () => {
    expect(removedTranslationsMessage(['Asad'])).toBe(
      'Asad is no longer available.',
    );
    expect(removedTranslationsMessage(['Asad', 'Arberry'])).toBe(
      'Asad, Arberry are no longer available.',
    );
    showRemovedTranslationsNotice([]);
    expect(mockToast).not.toHaveBeenCalled();
    showRemovedTranslationsNotice(['Asad', 'Arberry']);
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it('explains a refused translation download apart from a network failure', () => {
    expect(
      translationDownloadFailure(new Error('download_ticket_404')).title,
    ).toBe('Not available');
    expect(translationDownloadFailure(new Error('offline')).title).toBe(
      'Download Failed',
    );
  });
});
