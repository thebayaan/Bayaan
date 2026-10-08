jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
jest.mock('burnt', () => ({toast: jest.fn()}));
// tafseerStore now imports contentSync (Task 8); keep this suite on the installer alone.
jest.mock('@/services/content/contentSync', () => ({
  installContent: jest.fn(),
  removeContent: jest.fn(),
  isEngineManagingTafsir: () => false,
}));

import {resetDatabases} from '@/test-utils/mockExpoSqlite';
import type {ContentEnvelope} from '@/types/content';
import {showWithdrawalNotice} from '../contentNotices';
import {createTafsirInstaller, tafsirIdFromKey} from '../tafsirInstaller';

function makeStore(selected: string | null, installed: string[] = []) {
  const state = {
    selectedTafseerId: selected,
    downloadedMeta: installed.map(identifier => ({identifier})),
    setSelectedTafseerId: jest.fn((id: string | null) => {
      state.selectedTafseerId = id;
    }),
    loadDownloadedMeta: jest.fn().mockResolvedValue(undefined),
  };
  return {getState: () => state, state};
}

function makeDb(
  downloaded: Array<{
    identifier: string;
    name: string;
    language?: string;
    direction?: 'ltr' | 'rtl';
  }>,
) {
  return {
    saveTafseer: jest.fn().mockResolvedValue(undefined),
    deleteTafseer: jest.fn().mockResolvedValue(undefined),
    getDownloadedTafaseer: jest.fn().mockResolvedValue(downloaded),
  };
}

function makeEnvelope(
  records: Array<Record<string, unknown>>,
): ContentEnvelope {
  return {
    envelope: 1,
    key: 'qf:tafsirs:169',
    version: 2,
    source: 'qf',
    fetched_at: 'x',
    snapshot: {
      resource_group: 'tafsirs',
      resource_id: 169,
      schema_version: 1,
      records,
    },
  };
}

const envelope = makeEnvelope([
  {verse_id: 1, verse_key: '1:1', text: '<p>a</p>'},
]);

describe('tafsir installer', () => {
  it('maps keys to tafsir ids', () => {
    expect(tafsirIdFromKey('qf:tafsirs:169')).toBe('169');
  });

  it('installs parsed rows under the bare id and keeps the existing name', async () => {
    const db = makeDb([{identifier: '169', name: 'Ibn Kathir (Abridged)'}]);
    const store = makeStore('169');
    const installer = createTafsirInstaller({
      db: db as never,
      store: store as never,
    });
    await installer.install('qf:tafsirs:169', envelope, undefined);
    expect(db.saveTafseer).toHaveBeenCalledWith(
      '169',
      'Ibn Kathir (Abridged)',
      'Ibn Kathir (Abridged)',
      'English',
      'ltr',
      [expect.objectContaining({verseKey: '1:1', text: '<p>a</p>'})],
    );
    expect(store.state.loadDownloadedMeta).toHaveBeenCalled();
  });

  it('keeps an installed tafsir language and direction on an update without meta', async () => {
    const db = makeDb([
      {
        identifier: '16',
        name: 'Tafsir Muyassar',
        language: 'Arabic',
        direction: 'rtl',
      },
    ]);
    const installer = createTafsirInstaller({
      db: db as never,
      store: makeStore('16') as never,
    });
    await installer.install('qf:tafsirs:16', envelope, undefined);
    expect(db.saveTafseer).toHaveBeenCalledWith(
      '16',
      'Tafsir Muyassar',
      'Tafsir Muyassar',
      'Arabic',
      'rtl',
      expect.any(Array),
    );
  });

  it('names a fresh install from the manifest meta and maps ISO language codes', async () => {
    const db = makeDb([]);
    const installer = createTafsirInstaller({
      db: db as never,
      store: makeStore('169', ['169']) as never,
    });
    const outcome = await installer.install('qf:tafsirs:169', envelope, {
      name: 'Ibn Kathir',
      language: 'en',
      direction: 'ltr',
    });
    expect(db.saveTafseer).toHaveBeenCalledWith(
      '169',
      'Ibn Kathir',
      'Ibn Kathir',
      'English',
      'ltr',
      expect.any(Array),
    );
    expect(outcome).toEqual({name: 'Ibn Kathir'});
  });

  it('keeps Arabic and rtl for a picker install without meta (bundled list)', async () => {
    const db = makeDb([]);
    const installer = createTafsirInstaller({
      db: db as never,
      store: makeStore('16', ['16']) as never,
    });
    await installer.install('qf:tafsirs:16', envelope, undefined);
    expect(db.saveTafseer).toHaveBeenCalledWith(
      '16',
      'Tafsir Muyassar',
      'Tafsir Muyassar',
      'Arabic',
      'rtl',
      expect.any(Array),
    );
    expect(installer.fallbackName?.('qf:tafsirs:16')).toBe('Tafsir Muyassar');
  });

  it('falls back to placeholders for an id outside the bundled list', async () => {
    const db = makeDb([]);
    const installer = createTafsirInstaller({
      db: db as never,
      store: makeStore('999', ['999']) as never,
    });
    await installer.install('qf:tafsirs:999', envelope, {language: 'xx'});
    expect(db.saveTafseer).toHaveBeenCalledWith(
      '999',
      'Tafsir 999',
      'Tafsir 999',
      'English',
      'ltr',
      expect.any(Array),
    );
  });

  it('selects the installed tafsir when the selection is not installed', async () => {
    const store = makeStore('169', ['16']);
    const installer = createTafsirInstaller({
      db: makeDb([]) as never,
      store: store as never,
    });
    await installer.install('qf:tafsirs:16', envelope, undefined);
    expect(store.state.setSelectedTafseerId).toHaveBeenCalledWith('16');
  });

  it('keeps a selection that points at an installed tafsir', async () => {
    const store = makeStore('169', ['169', '16']);
    const installer = createTafsirInstaller({
      db: makeDb([]) as never,
      store: store as never,
    });
    await installer.install('qf:tafsirs:16', envelope, undefined);
    expect(store.state.setSelectedTafseerId).not.toHaveBeenCalled();
  });

  it('falls back to another installed tafsir when the selected one is withdrawn', async () => {
    const db = makeDb([{identifier: '16', name: 'Muyassar'}]);
    const store = makeStore('169');
    const installer = createTafsirInstaller({
      db: db as never,
      store: store as never,
    });
    await installer.remove('qf:tafsirs:169');
    await installer.onWithdrawn('qf:tafsirs:169');
    expect(db.deleteTafseer).toHaveBeenCalledWith('169');
    expect(store.state.setSelectedTafseerId).toHaveBeenCalledWith('16');
  });

  it('clears the selection when nothing else is installed', async () => {
    const store = makeStore('169');
    const installer = createTafsirInstaller({
      db: makeDb([]) as never,
      store: store as never,
    });
    await installer.onWithdrawn('qf:tafsirs:169');
    expect(store.state.setSelectedTafseerId).toHaveBeenCalledWith(null);
  });

  it('leaves an unrelated selection alone', async () => {
    const store = makeStore('16');
    const installer = createTafsirInstaller({
      db: makeDb([{identifier: '16', name: 'x'}]) as never,
      store: store as never,
    });
    await installer.onWithdrawn('qf:tafsirs:169');
    expect(store.state.setSelectedTafseerId).not.toHaveBeenCalled();
  });

  it('supports only schema version 1', () => {
    const installer = createTafsirInstaller({
      db: makeDb([]) as never,
      store: makeStore(null) as never,
    });
    expect(installer.supportsSchemaVersion(1)).toBe(true);
    expect(installer.supportsSchemaVersion(2)).toBe(false);
  });

  it('remove and onWithdrawn are idempotent when called twice', async () => {
    const db = makeDb([{identifier: '16', name: 'Muyassar'}]);
    const store = makeStore('169');
    const installer = createTafsirInstaller({
      db: db as never,
      store: store as never,
    });
    await installer.remove('qf:tafsirs:169');
    await installer.remove('qf:tafsirs:169');
    await installer.onWithdrawn('qf:tafsirs:169');
    await installer.onWithdrawn('qf:tafsirs:169');
    expect(store.state.selectedTafseerId).toBe('16');
    expect(store.state.setSelectedTafseerId).toHaveBeenCalledTimes(1);
  });

  it('second onWithdrawn keeps a null selection', async () => {
    const store = makeStore('169');
    const installer = createTafsirInstaller({
      db: makeDb([]) as never,
      store: store as never,
    });
    await installer.onWithdrawn('qf:tafsirs:169');
    await installer.onWithdrawn('qf:tafsirs:169');
    expect(store.state.selectedTafseerId).toBeNull();
    expect(store.state.setSelectedTafseerId).toHaveBeenCalledTimes(1);
  });
});

describe('tafsir installer against real SQLite', () => {
  // Real SQLite migrations per test can exceed the 5 s default under load.
  jest.setTimeout(15000);

  type Service =
    typeof import('@/services/tafseer/TafseerDbService').tafseerDbService;

  function freshService(): Service {
    let service: Service | undefined;
    jest.isolateModules(() => {
      service = require('@/services/tafseer/TafseerDbService').tafseerDbService;
    });
    if (!service) throw new Error('service not loaded');
    return service;
  }

  beforeEach(async () => {
    await resetDatabases();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replaces rows on a successful install', async () => {
    const svc = freshService();
    await svc.initialize();
    const installer = createTafsirInstaller({
      db: svc,
      store: makeStore('169') as never,
    });
    await installer.install('qf:tafsirs:169', envelope, undefined);
    await installer.install(
      'qf:tafsirs:169',
      makeEnvelope([{verse_id: 1, verse_key: '1:1', text: '<p>b</p>'}]),
      undefined,
    );
    expect((await svc.getTafseerForVerse('1:1', '169'))?.text).toBe('<p>b</p>');
  });

  it('drops verses that are absent from the new snapshot', async () => {
    const svc = freshService();
    await svc.initialize();
    const installer = createTafsirInstaller({
      db: svc,
      store: makeStore('169') as never,
    });
    await installer.install(
      'qf:tafsirs:169',
      makeEnvelope([
        {verse_id: 1, verse_key: '1:1', text: '<p>a</p>'},
        {verse_id: 2, verse_key: '1:2', text: '<p>b</p>'},
      ]),
      undefined,
    );
    expect((await svc.getTafseerForVerse('1:2', '169'))?.text).toBe('<p>b</p>');
    await installer.install('qf:tafsirs:169', envelope, undefined);
    expect((await svc.getTafseerForVerse('1:1', '169'))?.text).toBe('<p>a</p>');
    const after = await svc.getTafseerForVerse('1:2', '169');
    expect(after?.text ?? null).not.toBe('<p>b</p>');
  });

  it('keeps the previous rows when the parser fails', async () => {
    const svc = freshService();
    await svc.initialize();
    const installer = createTafsirInstaller({
      db: svc,
      store: makeStore('169') as never,
    });
    await installer.install('qf:tafsirs:169', envelope, undefined);
    const broken = makeEnvelope([]);
    Object.defineProperty(broken.snapshot, 'records', {
      get() {
        throw new Error('parse_boom');
      },
    });
    await expect(
      installer.install('qf:tafsirs:169', broken, undefined),
    ).rejects.toThrow('parse_boom');
    expect((await svc.getTafseerForVerse('1:1', '169'))?.text).toBe('<p>a</p>');
  });

  it('keeps the previous rows when SQL fails mid-transaction', async () => {
    const svc = freshService();
    await svc.initialize();
    const installer = createTafsirInstaller({
      db: svc,
      store: makeStore('169') as never,
    });
    await installer.install('qf:tafsirs:169', envelope, undefined);
    // The metadata insert runs after the old rows are deleted and the new ones inserted.
    const failing = {
      ...svc,
      saveTafseer: (...args: Parameters<Service['saveTafseer']>) => {
        const [id, name, english, language, direction, verses] = args;
        return svc.saveTafseer(id, name, english, language, direction, [
          ...verses,
          {...verses[0], text: null as never},
        ]);
      },
      getDownloadedTafaseer: () => svc.getDownloadedTafaseer(),
      deleteTafseer: (id: string) => svc.deleteTafseer(id),
    };
    const failingInstaller = createTafsirInstaller({
      db: failing,
      store: makeStore('169') as never,
    });
    await expect(
      failingInstaller.install(
        'qf:tafsirs:169',
        makeEnvelope([{verse_id: 1, verse_key: '1:1', text: '<p>c</p>'}]),
        undefined,
      ),
    ).rejects.toThrow();
    expect((await svc.getTafseerForVerse('1:1', '169'))?.text).toBe('<p>a</p>');
  });
});

describe('withdrawal notice', () => {
  it('shows the exact copy', () => {
    const burnt = require('burnt');
    showWithdrawalNotice({key: 'qf:tafsirs:169', name: 'Ibn Kathir'});
    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Content removed',
        message:
          'Ibn Kathir was withdrawn by its publisher via Quran Foundation.',
      }),
    );
  });
});
