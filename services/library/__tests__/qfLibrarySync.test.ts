import {BayaanSettingsApiError} from '@/services/settings/bayaanSettingsApiClient';
import type {LibraryCollection} from '@/services/settings/bayaanSettingsApiClient';
import {libraryCodec} from '@/services/library/qfLibraryDocuments';
import type {LibraryEntries} from '@/services/library/qfLibraryMerge';
import {
  syncQfLibrary,
  type QfLibraryLocalAdapter,
  type QfLibrarySyncApi,
} from '@/services/library/qfLibrarySync';
import {createQfLibrarySyncStorage} from '@/services/library/qfLibrarySyncStorage';

jest.mock('expo-crypto', () => {
  let n = 0;
  return {randomUUID: () => `uuid-${++n}`};
});

/** An in-memory QF App State with ETag preconditions. */
class FakeQf implements QfLibrarySyncApi {
  docs = new Map<string, {etag: string; value: unknown; readOnly?: boolean}>();
  enabled = ['library', 'playlists', 'adhkar'];
  writes: string[] = [];
  private version = 0;
  failNextPut?: number;

  async getAppStateCollections() {
    return this.enabled;
  }

  async listLibrary(_token: string, collection: LibraryCollection) {
    return [...this.docs]
      .filter(([id]) => id.startsWith(`${collection}/`))
      .map(([id, doc]) => ({
        key: id.slice(collection.length + 1),
        etag: doc.etag,
        value: doc.readOnly ? undefined : doc.value,
        readOnly: doc.readOnly === true,
      }));
  }

  async putLibrary(
    _token: string,
    input: {
      collection: LibraryCollection;
      key: string;
      value: unknown;
      etag?: string;
    },
  ) {
    if (this.failNextPut) {
      const status = this.failNextPut;
      this.failNextPut = undefined;
      throw new BayaanSettingsApiError(status, 'QF_SETTINGS_REJECTED');
    }
    const id = `${input.collection}/${input.key}`;
    const current = this.docs.get(id);
    if (input.etag ? current?.etag !== input.etag : current) {
      throw new BayaanSettingsApiError(412, 'QF_SETTINGS_CONFLICT');
    }
    const etag = `"v${++this.version}"`;
    this.docs.set(id, {etag, value: input.value});
    this.writes.push(`PUT ${id}`);
    return etag;
  }

  async deleteLibrary(
    _token: string,
    input: {collection: LibraryCollection; key: string; etag: string},
  ) {
    const id = `${input.collection}/${input.key}`;
    if (this.docs.get(id)?.etag !== input.etag) {
      throw new BayaanSettingsApiError(412, 'QF_SETTINGS_CONFLICT');
    }
    this.docs.delete(id);
    this.writes.push(`DELETE ${id}`);
  }
}

/** A device's own store for one collection. */
class FakeDevice implements QfLibraryLocalAdapter {
  docs = new Map<string, Record<string, string>>();
  editDuringApply?: () => void;
  constructor(
    readonly collection: LibraryCollection,
    readonly deletable = false,
  ) {}

  async readLocal() {
    return new Map([...this.docs].map(([k, v]) => [k, {...v}]));
  }

  async applyLocal(
    key: string,
    expected: LibraryEntries | null,
    next: LibraryEntries | null,
  ) {
    this.editDuringApply?.();
    this.editDuringApply = undefined;
    const current = this.docs.get(key) ?? null;
    const same =
      JSON.stringify(sorted(current ?? (this.deletable ? null : {}))) ===
      JSON.stringify(sorted(expected ?? (this.deletable ? null : {})));
    if (!same) return false;
    if (next === null) this.docs.delete(key);
    else this.docs.set(key, {...next});
    return true;
  }
}

function sorted(entries: Record<string, string> | null) {
  return entries && Object.fromEntries(Object.entries(entries).sort());
}

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => void data.set(key, value),
    removeItem: async (key: string) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
  };
}

function device(
  qf: FakeQf,
  adapter: FakeDevice,
  accountId = 'acct',
  storage = createQfLibrarySyncStorage(memoryStore()),
) {
  return {
    adapter,
    storage,
    sync: () =>
      syncQfLibrary(
        {api: qf, storage, adapters: [adapter]},
        {accountId, sessionToken: 'token', isCurrent: () => true},
      ),
  };
}

function remoteEntries(qf: FakeQf, collection: LibraryCollection, key: string) {
  const doc = qf.docs.get(`${collection}/${key}`);
  return doc && libraryCodec(collection, key)!.decode(doc.value);
}

describe('syncQfLibrary', () => {
  it('uploads, then a second device pulls and both converge', async () => {
    const qf = new FakeQf();
    const a = device(qf, new FakeDevice('library'));
    const b = device(qf, new FakeDevice('library'));
    a.adapter.docs.set('reciters', {alafasy: '1'});
    b.adapter.docs.set('reciters', {husary: '2'});

    expect(await a.sync()).toEqual({rerun: false, unavailable: []});
    await b.sync();
    await a.sync();

    expect(a.adapter.docs.get('reciters')).toEqual({alafasy: '1', husary: '2'});
    expect(b.adapter.docs.get('reciters')).toEqual({alafasy: '1', husary: '2'});
    expect(remoteEntries(qf, 'library', 'reciters')).toEqual({
      alafasy: '1',
      husary: '2',
    });
  });

  it('propagates a removal instead of resurrecting it', async () => {
    const qf = new FakeQf();
    const a = device(qf, new FakeDevice('library'));
    const b = device(qf, new FakeDevice('library'));
    a.adapter.docs.set('loved-18', {'r|hafs': '1', 'r|warsh': '2'});
    await a.sync();
    await b.sync();
    b.adapter.docs.set('loved-18', {'r|warsh': '2'});
    await b.sync();
    await a.sync();
    expect(a.adapter.docs.get('loved-18')).toEqual({'r|warsh': '2'});
  });

  it('writes nothing when nothing changed', async () => {
    const qf = new FakeQf();
    const a = device(qf, new FakeDevice('adhkar'));
    a.adapter.docs.set('saved', {d1: '1'});
    await a.sync();
    qf.writes = [];
    await a.sync();
    expect(qf.writes).toEqual([]);
  });

  it('reruns after a precondition conflict and then merges', async () => {
    const qf = new FakeQf();
    const a = device(qf, new FakeDevice('adhkar'));
    const b = device(qf, new FakeDevice('adhkar'));
    a.adapter.docs.set('saved', {d1: '1'});
    await a.sync();
    await b.sync();
    // B edits; A edits and writes first, so B's write meets a stale ETag.
    b.adapter.docs.set('saved', {d1: '1', d2: '2'});
    a.adapter.docs.set('saved', {d1: '1', d3: '3'});
    const listed = qf.listLibrary.bind(qf);
    jest.spyOn(qf, 'listLibrary').mockImplementationOnce(async (t, c) => {
      const result = await listed(t, c);
      await a.sync();
      return result;
    });
    expect((await b.sync()).rerun).toBe(true);
    expect((await b.sync()).rerun).toBe(false);
    expect(b.adapter.docs.get('saved')).toEqual({d1: '1', d2: '2', d3: '3'});
  });

  it('reruns when the user edits during sync, without losing the edit', async () => {
    const qf = new FakeQf();
    const a = device(qf, new FakeDevice('library'));
    const b = device(qf, new FakeDevice('library'));
    b.adapter.docs.set('reciters', {r1: '1'});
    await b.sync();
    a.adapter.editDuringApply = () =>
      a.adapter.docs.set('reciters', {mine: '9'});
    expect((await a.sync()).rerun).toBe(true);
    await a.sync();
    expect(a.adapter.docs.get('reciters')).toEqual({mine: '9', r1: '1'});
  });

  it('creates, renames remotely, and deletes playlists', async () => {
    const qf = new FakeQf();
    const a = device(qf, new FakeDevice('playlists', true));
    const b = device(qf, new FakeDevice('playlists', true));
    const playlist = {
      name: 'Morning',
      color: '#fff',
      description: 'null',
      createdAt: '1',
      items: '[[18,"r","hafs"]]',
    };
    a.adapter.docs.set('p1', playlist);
    await a.sync();
    await b.sync();
    expect(b.adapter.docs.get('p1')).toEqual(playlist);

    b.adapter.docs.set('p1', {...playlist, name: 'Evening'});
    await b.sync();
    await a.sync();
    expect(a.adapter.docs.get('p1')?.name).toBe('Evening');

    a.adapter.docs.delete('p1');
    await a.sync();
    expect(qf.docs.has('playlists/p1')).toBe(false);
    await b.sync();
    expect(b.adapter.docs.has('p1')).toBe(false);
  });

  it('keeps a playlist edited on one device while deleted on another', async () => {
    const qf = new FakeQf();
    const a = device(qf, new FakeDevice('playlists', true));
    const b = device(qf, new FakeDevice('playlists', true));
    const playlist = {
      name: 'A',
      color: 'c',
      description: 'null',
      createdAt: '1',
      items: '[]',
    };
    a.adapter.docs.set('p1', playlist);
    await a.sync();
    await b.sync();
    b.adapter.docs.set('p1', {...playlist, name: 'B'});
    await b.sync();
    a.adapter.docs.delete('p1');
    await a.sync();
    expect(a.adapter.docs.get('p1')?.name).toBe('B');
    expect(qf.docs.has('playlists/p1')).toBe(true);
  });

  it('leaves read-only and unknown documents alone', async () => {
    const qf = new FakeQf();
    qf.docs.set('library/reciters', {
      etag: '"x"',
      value: undefined,
      readOnly: true,
    });
    qf.docs.set('library/loved-2', {etag: '"y"', value: {v: 'future'}});
    const a = device(qf, new FakeDevice('library'));
    a.adapter.docs.set('reciters', {r: '1'});
    a.adapter.docs.set('loved-2', {'r|hafs': '1'});
    await a.sync();
    expect(qf.writes).toEqual([]);
    expect(a.adapter.docs.get('reciters')).toEqual({r: '1'});
  });

  it('skips collections QF has not enabled', async () => {
    const qf = new FakeQf();
    qf.enabled = ['library'];
    const storage = createQfLibrarySyncStorage(memoryStore());
    const result = await syncQfLibrary(
      {
        api: qf,
        storage,
        adapters: [new FakeDevice('library'), new FakeDevice('adhkar')],
      },
      {accountId: 'acct', sessionToken: 't', isCurrent: () => true},
    );
    expect(result).toEqual({rerun: false, unavailable: ['adhkar']});
  });

  it('treats App State being off as unavailable, and a revoked session as revoked', async () => {
    const qf = new FakeQf();
    const storage = createQfLibrarySyncStorage(memoryStore());
    const run = () =>
      syncQfLibrary(
        {api: qf, storage, adapters: [new FakeDevice('library')]},
        {accountId: 'acct', sessionToken: 't', isCurrent: () => true},
      );
    jest
      .spyOn(qf, 'getAppStateCollections')
      .mockRejectedValueOnce(
        new BayaanSettingsApiError(403, 'QF_SETTINGS_FORBIDDEN'),
      );
    expect(await run()).toEqual({rerun: false, unavailable: ['library']});
    jest
      .spyOn(qf, 'listLibrary')
      .mockRejectedValueOnce(
        new BayaanSettingsApiError(401, 'QF_SESSION_INVALID'),
      );
    await expect(run()).rejects.toMatchObject({code: 'session_revoked'});
  });

  it('keeps going after one document is refused', async () => {
    const qf = new FakeQf();
    const a = device(qf, new FakeDevice('library'));
    a.adapter.docs.set('loved-1', {'r|hafs': '1'});
    a.adapter.docs.set('loved-2', {'r|hafs': '2'});
    qf.failNextPut = 400;
    await a.sync();
    expect(qf.docs.has('library/loved-1')).toBe(false);
    expect(qf.docs.has('library/loved-2')).toBe(true);
  });

  it('stops applying once the account is no longer current', async () => {
    const qf = new FakeQf();
    qf.docs.set('library/reciters', {etag: '"x"', value: {v: [['r', 1]]}});
    const adapter = new FakeDevice('library');
    await syncQfLibrary(
      {
        api: qf,
        storage: createQfLibrarySyncStorage(memoryStore()),
        adapters: [adapter],
      },
      {accountId: 'acct', sessionToken: 't', isCurrent: () => false},
    );
    expect(adapter.docs.size).toBe(0);
  });
});

describe('purgeSyncedLibrary', () => {
  const {purgeSyncedLibrary} = jest.requireActual(
    '@/services/library/qfLibrarySync',
  );

  it('removes only items exactly as last synced, then forgets the account', async () => {
    const qf = new FakeQf();
    const a = device(qf, new FakeDevice('library'));
    a.adapter.docs.set('reciters', {r1: '1', r2: '2'});
    await a.sync();
    a.adapter.docs.set('reciters', {r1: '1', r2: '2', r3: '3'}); // not synced yet
    await purgeSyncedLibrary(
      {storage: a.storage, adapters: [a.adapter]},
      'acct',
    );
    expect(a.adapter.docs.get('reciters')).toEqual({r3: '3'});
    expect((await a.storage.load('acct', 'library')).size).toBe(0);
  });

  it('deletes synced playlists but keeps ones edited since', async () => {
    const qf = new FakeQf();
    const a = device(qf, new FakeDevice('playlists', true));
    const playlist = {
      name: 'A',
      color: 'c',
      description: 'null',
      createdAt: '1',
      items: '[]',
    };
    a.adapter.docs.set('p1', playlist);
    a.adapter.docs.set('p2', playlist);
    await a.sync();
    a.adapter.docs.set('p2', {...playlist, name: 'edited'});
    await purgeSyncedLibrary(
      {storage: a.storage, adapters: [a.adapter]},
      'acct',
    );
    expect([...a.adapter.docs.keys()]).toEqual(['p2']);
  });
});

describe('account switching', () => {
  it("clears another account's synced items before syncing a new one", async () => {
    const qf = new FakeQf();
    const otherQf = new FakeQf();
    const storage = createQfLibrarySyncStorage(memoryStore());
    const adapter = new FakeDevice('library');
    const a = device(qf, adapter, 'account-a', storage);
    adapter.docs.set('reciters', {fromA: '1'});
    await a.sync();
    adapter.docs.set('reciters', {fromA: '1', guest: '2'});
    // Account A's session expires; account B signs in on the same device.
    const b = device(otherQf, adapter, 'account-b', storage);
    await b.sync();
    expect(adapter.docs.get('reciters')).toEqual({guest: '2'});
    expect(remoteEntries(otherQf, 'library', 'reciters')).toEqual({guest: '2'});
    expect(await storage.accounts()).toEqual(['account-b']);
  });
});
