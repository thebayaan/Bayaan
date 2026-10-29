// @ai-generated
// The default reciter pick must survive a restart, and loading the reciter
// catalog must never write over it.
import type {Reciter} from '@/data/reciterData';

const mockStorage = new Map<string, string>();
let mockReadError: Error | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => {
    if (mockReadError) throw mockReadError;
    return mockStorage.get(key) ?? null;
  },
  setItem: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    mockStorage.delete(key);
  },
}));

const MISHARY_ID = 'b3bca7d8-b004-4511-b46e-f3527f6b1f67';

function reciter(id: string, name: string, rewayahNames: string[]): Reciter {
  return {
    id,
    name,
    date: null,
    image_url: null,
    rewayat: rewayahNames.map((rewayah, i) => ({
      id: `${id}-r${i}`,
      reciter_id: id,
      name: rewayah,
      style: 'murattal',
      server: `https://example.com/${id}/${i}/`,
      surah_total: 114,
      surah_list: [1],
      source_type: 'mp3quran',
      created_at: '2026-01-01',
    })),
  };
}

const MISHARY = reciter(MISHARY_ID, 'Mishary Alafasi', [
  "AlDorai A'n Al-Kisa'ai",
  "Hafs A'n Assem",
]);
const NOREEN = reciter('noreen', 'Noreen Mohammad Siddiq', [
  "Aldori A'n Abi Amr",
]);
const SUDAIS = reciter('sudais', 'Abdulrahman Alsudaes', [
  "Warsh A'n Nafi'",
  "Hafs A'n Assem",
]);
const CATALOG = [NOREEN, SUDAIS, MISHARY];

type App = {
  store: typeof import('../reciterStore').useReciterStore;
  RECITERS: Reciter[];
};

/** A fresh app launch: new module instances reading the same storage. */
function launch(): App {
  let app!: App;
  jest.isolateModules(() => {
    app = {
      store: require('../reciterStore').useReciterStore,
      RECITERS: require('@/data/reciterData').RECITERS,
    };
  });
  return app;
}

/** What dataService.populateReciters does once the catalog loads. */
function loadCatalog({store, RECITERS}: App, catalog = CATALOG) {
  RECITERS.splice(0, RECITERS.length, ...catalog);
  store.getState().catalogLoaded();
}

/** Lets storage reads and writes settle. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function savePick(state: object, version: number) {
  mockStorage.set('reciter-storage', JSON.stringify({state, version}));
}

function savedPick() {
  const raw = mockStorage.get('reciter-storage');
  return raw ? JSON.parse(raw) : undefined;
}

const defaultId = (app: App) => app.store.getState().defaultReciter.id;

beforeEach(() => {
  mockStorage.clear();
  mockReadError = null;
});

it('starts a new install with Mishary Alafasi, Hafs first', async () => {
  const app = launch();
  await settle();
  loadCatalog(app);
  const current = app.store.getState().defaultReciter;
  expect(current.id).toBe(MISHARY_ID);
  expect(current.rewayat[0].name).toBe("Hafs A'n Assem");
  expect(app.store.getState().isInitialized).toBe(true);
});

it('keeps a picked reciter across a restart', async () => {
  const first = launch();
  await settle();
  loadCatalog(first);
  first.store.getState().setDefaultReciter(SUDAIS);
  expect(defaultId(first)).toBe('sudais');
  await settle();

  const second = launch();
  await settle();
  loadCatalog(second);
  expect(defaultId(second)).toBe('sudais');
});

it('keeps a picked reciter that has no Hafs recitation', async () => {
  savePick({defaultReciterId: 'noreen'}, 1);
  const app = launch();
  await settle();
  loadCatalog(app);
  expect(defaultId(app)).toBe('noreen');
});

it('keeps the pick when the catalog loads before storage is read', async () => {
  savePick({defaultReciterId: 'sudais'}, 1);
  const app = launch();
  loadCatalog(app);
  await settle();
  expect(defaultId(app)).toBe('sudais');
  expect(savedPick()).toEqual({
    state: {defaultReciterId: 'sudais'},
    version: 1,
  });
});

it('never saves anything just because the catalog loaded', async () => {
  const app = launch();
  loadCatalog(app);
  await settle();
  loadCatalog(app);
  expect(mockStorage.has('reciter-storage')).toBe(false);
});

it('carries over a pick saved by the old whole-reciter format', async () => {
  const stale = {...SUDAIS, name: 'Old name'};
  savePick({defaultReciter: stale}, 0);
  const app = launch();
  await settle();
  loadCatalog(app);
  // Read from the current catalog, not the stale copy.
  expect(app.store.getState().defaultReciter.name).toBe('Abdulrahman Alsudaes');
  expect(savedPick()).toEqual({
    state: {defaultReciterId: 'sudais'},
    version: 1,
  });
});

it('treats an empty reciter saved by the old format as no pick', async () => {
  savePick({defaultReciter: {id: '', rewayat: []}}, 0);
  const app = launch();
  await settle();
  loadCatalog(app);
  expect(defaultId(app)).toBe(MISHARY_ID);
});

it('falls back to Mishary when the picked reciter left the catalog', async () => {
  savePick({defaultReciterId: 'gone'}, 1);
  const app = launch();
  await settle();
  loadCatalog(app);
  expect(defaultId(app)).toBe(MISHARY_ID);
});

it('falls back to a Hafs reciter when Mishary is not in the catalog', async () => {
  const app = launch();
  await settle();
  loadCatalog(app, [NOREEN, SUDAIS]);
  expect(defaultId(app)).toBe('sudais');
});

it('still resolves a default when storage cannot be read', async () => {
  mockReadError = new Error('read failed');
  const app = launch();
  await settle();
  loadCatalog(app);
  expect(defaultId(app)).toBe(MISHARY_ID);
});

it('ships the built-in default in the bundled catalog with Hafs', () => {
  const {BUILT_IN_DEFAULT_RECITER_ID} = require('../reciterStore');
  const fallback: Reciter[] = require('@/data/reciters-fallback.json');
  const builtIn = fallback.find(r => r.id === BUILT_IN_DEFAULT_RECITER_ID);
  expect(builtIn?.name).toBe('Mishary Alafasi');
  expect(builtIn?.rewayat.some(r => r.name === "Hafs A'n Assem")).toBe(true);
});
