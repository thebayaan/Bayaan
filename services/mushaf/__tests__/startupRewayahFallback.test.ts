// @ai-generated
/**
 * Startup fallback end to end, with the real settings store and the real data
 * service: when the saved rewayah cannot be loaded, Hafs is shown and the
 * store (which every label reads) says Hafs, but the saved rewayah stays
 * persisted, so the next launch tries it again; a retry or an explicit choice
 * ends the fallback.
 *
 * expo-sqlite is reduced to what a load needs: every words DB holds the same
 * two slots of verse 1:1 with text tagged by DB (H1/H2 for Hafs, W1/W2 for
 * Warsh), and DBs whose base name is in `__broken` fail every read.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DigitalKhattDataService} from '../DigitalKhattDataService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-sqlite', () => {
  const broken = new Set<string>();
  const files = new Set<string>();
  const baseOf = (name: string) =>
    name.replace(/\.db$/, '').replace(/\.[0-9a-f]{8}$/, '');
  return {
    __broken: broken,
    defaultDatabaseDirectory: '/data/user/0/app.test/files/SQLite',
    async openDatabaseAsync(name: string) {
      return {
        async getFirstAsync(sql: string) {
          if (!files.has(name)) return null;
          return {name: /name='(\w+)'/.exec(sql)?.[1]};
        },
        async getAllAsync(sql: string) {
          const base = baseOf(name);
          if (broken.has(base)) {
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
          const tag = base === 'dk_words' ? 'H' : 'W';
          return [
            {id: 1, text: `${tag}1`, location: '1:1:1'},
            {id: 2, text: `${tag}2`, location: '1:1:2'},
          ];
        },
        closeAsync: async () => undefined,
      };
    },
    async importDatabaseFromAssetAsync(name: string) {
      files.add(name);
    },
    async deleteDatabaseAsync(name: string) {
      files.delete(name);
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: jest.fn(async () => []),
}));

const sqlite = jest.requireMock('expo-sqlite') as {__broken: Set<string>};

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

async function persisted(): Promise<Record<string, unknown>> {
  await flush();
  const raw = await AsyncStorage.getItem('mushaf-settings');
  return raw ? (JSON.parse(raw).state as Record<string, unknown>) : {};
}

async function launchWithBrokenWarsh(): Promise<DigitalKhattDataService> {
  sqlite.__broken.add('dk_words_warsh');
  const service = new DigitalKhattDataService();
  await service.initialize();
  sqlite.__broken.clear();
  return service;
}

let consoleSpies: jest.SpyInstance[] = [];

beforeEach(async () => {
  sqlite.__broken.clear();
  useMushafSettingsStore.setState({
    rewayah: 'warsh',
    mushafRenderer: 'dk_v2',
    uthmaniFont: 'v2',
    rewayahFallbackFrom: null,
  });
  await flush();
  consoleSpies = [
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
    jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    jest.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
});

afterEach(async () => {
  await flush();
  for (const spy of consoleSpies) spy.mockRestore();
});

describe('startup fallback with the real settings store', () => {
  it('shows Hafs under a Hafs label and keeps Warsh saved', async () => {
    expect((await persisted()).rewayah).toBe('warsh');

    const service = await launchWithBrokenWarsh();

    expect(service.rewayah).toBe('hafs');
    expect(service.getVerseText('1:1')).toBe('H1 H2');
    const settings = useMushafSettingsStore.getState();
    expect(settings.rewayah).toBe('hafs');
    expect(settings.rewayahFallbackFrom).toBe('warsh');
    const saved = await persisted();
    expect(saved.rewayah).toBe('warsh');
    expect(saved).not.toHaveProperty('rewayahFallbackFrom');
  });

  it('tries the saved rewayah again on the next launch', async () => {
    await launchWithBrokenWarsh();
    expect((await persisted()).rewayah).toBe('warsh');

    // Next launch: the persisted settings are read back, and the session
    // starts without the (never persisted) fallback marker.
    await useMushafSettingsStore.persist.rehydrate();
    useMushafSettingsStore.setState({rewayahFallbackFrom: null});
    expect(useMushafSettingsStore.getState().rewayah).toBe('warsh');
    expect((await persisted()).rewayah).toBe('warsh');

    const next = new DigitalKhattDataService();
    await next.initialize();
    expect(next.rewayah).toBe('warsh');
    expect(next.getVerseText('1:1')).toBe('W1 W2');
    expect(useMushafSettingsStore.getState().rewayah).toBe('warsh');
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();
  });

  it('ends the fallback when a retry loads the saved rewayah', async () => {
    const service = await launchWithBrokenWarsh();

    await service.switchRewayah('warsh');

    expect(service.getVerseText('1:1')).toBe('W1 W2');
    expect(useMushafSettingsStore.getState().rewayah).toBe('warsh');
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();
    expect((await persisted()).rewayah).toBe('warsh');
  });

  it('keeps the fallback (and the saved rewayah) when a retry fails again', async () => {
    const service = await launchWithBrokenWarsh();
    sqlite.__broken.add('dk_words_warsh');

    await expect(service.switchRewayah('warsh')).rejects.toThrow();

    expect(service.rewayah).toBe('hafs');
    expect(useMushafSettingsStore.getState().rewayah).toBe('hafs');
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBe('warsh');
    expect((await persisted()).rewayah).toBe('warsh');
  });

  it('saves Hafs once the reader chooses to keep it', async () => {
    await launchWithBrokenWarsh();

    useMushafSettingsStore.getState().clearRewayahFallback();

    expect(useMushafSettingsStore.getState().rewayah).toBe('hafs');
    expect((await persisted()).rewayah).toBe('hafs');
  });
});
