// @ai-generated
/**
 * The startup fallback notice ("Couldn't load Warsh / Showing Hafs instead")
 * must name the rewayah that failed and appear only once Hafs is really on
 * screen. Real settings store, real data service, real notice
 * (components/sheets/rewayahFallbackNotice.ts) and real selection flow;
 * expo-sqlite is a fake whose reads can be held (gates) or always fail
 * (broken bases, so a delete + re-import does not help).
 */
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {DigitalKhattDataService} from '../DigitalKhattDataService';
import {installRewayahFallbackNotice} from '@/components/sheets/rewayahFallbackNotice';
import {chooseMushafRewayah} from '@/components/sheets/rewayahSelection';

interface FakeSqlite {
  files: Set<string>;
  gates: Map<string, Promise<void>>;
  broken: Set<string>;
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));

// rewayahSelection talks to the app's singleton; these tests drive their own
// instance, so the module's singleton is that instance.
jest.mock('../DigitalKhattDataService', () => {
  const actual = jest.requireActual('../DigitalKhattDataService');
  const holder: {current: unknown} = {current: null};
  const mocked = Object.assign({}, actual, {__holder: holder});
  Object.defineProperty(mocked, 'digitalKhattDataService', {
    enumerable: true,
    get: () => holder.current,
  });
  return mocked;
});

jest.mock('expo-sqlite', () => {
  const state: FakeSqlite = {
    files: new Set(),
    gates: new Map(),
    broken: new Set(),
  };
  const TAG: Record<string, string> = {
    dk_words: 'H',
    dk_words_warsh: 'W',
    dk_words_qaloon: 'Q',
  };
  const baseOf = (name: string) =>
    name.replace(/\.db$/, '').replace(/\.[0-9a-f]{8}$/, '');
  return {
    __fake: state,
    defaultDatabaseDirectory: '/data/user/0/app.test/files/SQLite',
    async openDatabaseAsync(name: string) {
      const base = baseOf(name);
      return {
        async getFirstAsync(sql: string) {
          if (!state.files.has(name)) return null;
          return {name: /name='(\w+)'/.exec(sql)?.[1]};
        },
        async getAllAsync(sql: string) {
          const held = state.gates.get(base);
          if (held) await held;
          if (state.broken.has(base)) {
            throw new Error('database disk image is malformed');
          }
          if (sql.includes('FROM pages')) {
            return [
              {
                page_number: 1,
                line_number: 1,
                line_type: 'ayah',
                is_centered: 0,
                first_word_id: 1,
                last_word_id: 2,
                surah_number: 1,
              },
            ];
          }
          const tag = TAG[base] ?? '?';
          return [
            {id: 1, text: `${tag}1`, location: '1:1:1'},
            {id: 2, text: `${tag}2`, location: '1:1:2'},
          ];
        },
        closeAsync: async () => undefined,
      };
    },
    async importDatabaseFromAssetAsync(name: string) {
      state.files.add(name);
    },
    async deleteDatabaseAsync(name: string) {
      state.files.delete(name);
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: jest.fn(async () => []),
}));

const fake = (jest.requireMock('expo-sqlite') as {__fake: FakeSqlite}).__fake;
const holder = (
  jest.requireMock('../DigitalKhattDataService') as {
    __holder: {current: DigitalKhattDataService | null};
  }
).__holder;
const {showToast} = jest.requireMock('@/utils/toastUtils') as {
  showToast: jest.Mock;
};

const FALLBACK_TOAST = ['Showing Hafs instead.'];

function fallbackToasts(): unknown[][] {
  return showToast.mock.calls.filter(call => call[1] === FALLBACK_TOAST[0]);
}

// Holds every read of `base` until the returned function is called.
function gate(base: string): () => void {
  let release: () => void = () => undefined;
  const held = new Promise<void>(resolve => {
    release = () => {
      fake.gates.delete(base);
      resolve();
    };
  });
  fake.gates.set(base, held);
  return release;
}

async function flush(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

function newService(): DigitalKhattDataService {
  const service = new DigitalKhattDataService();
  holder.current = service;
  return service;
}

let uninstall: (() => void) | null = null;
let consoleSpies: jest.SpyInstance[] = [];

beforeEach(async () => {
  fake.files.clear();
  fake.gates.clear();
  fake.broken.clear();
  useMushafSettingsStore.setState({
    rewayah: 'warsh',
    mushafRenderer: 'dk_v2',
    uthmaniFont: 'v2',
    rewayahFallbackFrom: null,
  });
  await flush();
  showToast.mockReset();
  consoleSpies = [
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
    jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    jest.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
  uninstall = installRewayahFallbackNotice();
});

afterEach(async () => {
  uninstall?.();
  uninstall = null;
  await flush();
  for (const spy of consoleSpies) spy.mockRestore();
});

describe('startup fallback notice', () => {
  it('does not blame the saved rewayah when a choice made during startup fails', async () => {
    const releaseWarsh = gate('dk_words_warsh');
    fake.broken.add('dk_words_qaloon');
    const service = newService();

    const init = service.initialize().then(
      () => 'ok',
      (error: Error) => error.message,
    );
    await flush();
    // The reader picks Qalun while the saved Warsh is still loading, and
    // Qalun cannot be loaded.
    const pick = chooseMushafRewayah('qalun');
    releaseWarsh();

    expect(await init).toBe('ok');
    expect((await pick).kind).toBe('failed');
    expect(service.rewayah).toBe('warsh');
    expect(service.getVerseText('1:1')).toBe('W1 W2');
    expect(useMushafSettingsStore.getState()).toMatchObject({
      rewayah: 'warsh',
      rewayahFallbackFrom: null,
    });
    expect(showToast.mock.calls.map(call => call[0])).toEqual([
      "Couldn't load Qalun",
    ]);
    expect(fallbackToasts()).toEqual([]);
  });

  it('never says Hafs is shown when Hafs cannot be loaded either', async () => {
    fake.broken.add('dk_words_warsh');
    fake.broken.add('dk_words');
    const service = newService();

    await expect(service.initialize()).rejects.toThrow(/"hafs"/);

    expect(service.initialized).toBe(false);
    expect(fallbackToasts()).toEqual([]);
    expect(useMushafSettingsStore.getState()).toMatchObject({
      rewayah: 'warsh',
      rewayahFallbackFrom: null,
    });
  });

  it('is shown only once Hafs is on screen', async () => {
    fake.broken.add('dk_words_warsh');
    const releaseHafs = gate('dk_words');
    const service = newService();
    const atToast: unknown[] = [];
    showToast.mockImplementation(() => {
      atToast.push({
        initialized: service.initialized,
        rewayah: service.rewayah,
        text: service.getVerseText('1:1'),
        label: useMushafSettingsStore.getState().rewayah,
      });
    });

    const init = service.initialize();
    await flush();
    // Warsh failed; Hafs is still loading: nothing may claim it is shown.
    expect(service.initialized).toBe(false);
    expect(fallbackToasts()).toEqual([]);
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();

    releaseHafs();
    await init;
    expect(fallbackToasts()).toEqual([
      ["Couldn't load Warsh", 'Showing Hafs instead.', 'error'],
    ]);
    expect(atToast).toEqual([
      {initialized: true, rewayah: 'hafs', text: 'H1 H2', label: 'hafs'},
    ]);
    expect(useMushafSettingsStore.getState()).toMatchObject({
      rewayah: 'hafs',
      rewayahFallbackFrom: 'warsh',
    });
  });

  it('records no fallback when the reader chooses another rewayah before Hafs lands', async () => {
    fake.broken.add('dk_words_warsh');
    const releaseHafs = gate('dk_words');
    const service = newService();

    const init = service.initialize();
    await flush();
    const pick = chooseMushafRewayah('qalun');
    releaseHafs();
    await init;
    await pick;

    expect(service.rewayah).toBe('qalun');
    expect(fallbackToasts()).toEqual([]);
    expect(useMushafSettingsStore.getState()).toMatchObject({
      rewayah: 'qalun',
      rewayahFallbackFrom: null,
    });
  });
});
