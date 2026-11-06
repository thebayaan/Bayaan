jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
jest.mock('burnt', () => ({toast: jest.fn()}));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({getString: jest.fn(), set: jest.fn()}),
}));

type StoreModule = typeof import('@/store/tafseerStore');
type SyncModule = typeof import('@/services/content/contentSync');
type InstallerModule = typeof import('@/services/content/tafsirInstaller');

function expectWired(
  store: StoreModule,
  sync: SyncModule,
  installer: InstallerModule,
): void {
  expect(typeof installer.createTafsirInstaller).toBe('function');
  expect(typeof store.useTafseerStore.getState().downloadTafseer).toBe(
    'function',
  );
  expect(typeof sync.installContent).toBe('function');
  expect(installer.createTafsirInstaller().kind).toBe('tafsir');
}

// No mock of contentSync: guards the store -> contentSync -> tafsirInstaller
// -> store cycle against a future top-level read.
describe('content sync import cycle', () => {
  it('loads store first, then contentSync', () => {
    jest.isolateModules(() => {
      const store: StoreModule = require('@/store/tafseerStore');
      const sync: SyncModule = require('@/services/content/contentSync');
      const installer: InstallerModule = require('@/services/content/tafsirInstaller');
      expectWired(store, sync, installer);
    });
  });

  it('loads contentSync first, then store', () => {
    jest.isolateModules(() => {
      const sync: SyncModule = require('@/services/content/contentSync');
      const store: StoreModule = require('@/store/tafseerStore');
      const installer: InstallerModule = require('@/services/content/tafsirInstaller');
      expectWired(store, sync, installer);
    });
  });

  it('loads tafsirInstaller first', () => {
    jest.isolateModules(() => {
      const installer: InstallerModule = require('@/services/content/tafsirInstaller');
      const store: StoreModule = require('@/store/tafseerStore');
      const sync: SyncModule = require('@/services/content/contentSync');
      expectWired(store, sync, installer);
    });
  });
});
