jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock(
  '../../../data/mushaf/digitalkhatt/digital-khatt-15-lines.db',
  () => 1,
);
jest.mock('../../../data/mushaf/digitalkhatt/digital-khatt-v2.db', () => 2);
jest.mock('../../../data/mushaf/digitalkhatt/dk_words_shouba.db', () => 3);
jest.mock('../../../data/mushaf/digitalkhatt/dk_words_bazzi.db', () => 4);
jest.mock('../../../data/mushaf/digitalkhatt/dk_words_qumbul.db', () => 5);
jest.mock('../../../data/mushaf/digitalkhatt/dk_words_warsh.db', () => 6);
jest.mock('../../../data/mushaf/digitalkhatt/dk_words_qaloon.db', () => 7);
jest.mock('../../../data/mushaf/digitalkhatt/dk_words_doori.db', () => 8);
jest.mock('../../../data/mushaf/digitalkhatt/dk_words_soosi.db', () => 9);

// Exercise the real cache builder with deterministic SQLite boundary fixtures,
// not a switchRewayah mock. No native/provider/network success is implied.
let mockRead: ((database: string) => Promise<void>) | undefined;
const mockOpen = jest.fn(async (database: string) => ({
  getFirstAsync: async () => ({name: 'words'}),
  getAllAsync: async () => {
    await mockRead?.(database);
    return database === 'dk_layout.db'
      ? [
          {
            page_number: 1,
            line_number: 1,
            line_type: 'ayah',
            first_word_id: 1,
            last_word_id: 1,
          },
        ]
      : [{id: 1, text: database, location: '1:1:1'}];
  },
  closeAsync: async () => undefined,
}));
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (database: string) => mockOpen(database),
  deleteDatabaseAsync: async () => undefined,
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({settings: {}}), setState: jest.fn()},
}));
jest.mock('@/store/ambientStore', () => ({
  useAmbientStore: {
    getState: () => ({currentSound: null, volume: 0.5}),
    setState: jest.fn(),
  },
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {getState: () => ({rate: 1}), setState: jest.fn()},
}));
jest.mock('@/store/translationStore', () => ({
  useTranslationStore: {getState: () => ({downloadedMeta: []})},
}));

import {digitalKhattDataService as cache} from '@/services/mushaf/DigitalKhattDataService';
import {useMushafSettingsStore as mushaf} from '@/store/mushafSettingsStore';
import {useThemeStore} from '@/store/themeStore';
import {applySettingsDocuments} from '../qfSettingsSnapshot';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

async function blockWords(database: string) {
  const started = deferred();
  const gate = deferred();
  mockRead = async name => {
    if (name === database) {
      started.resolve();
      await gate.promise;
    }
  };
  return {started: started.promise, release: gate.resolve};
}

beforeEach(async () => {
  mockRead = undefined;
  mushaf.setState({
    mushafRenderer: 'dk_v1',
    rewayah: 'hafs',
    showTajweed: true,
    showRewayahDiffs: true,
    showTranslation: true,
  });
  await cache.switchRewayah('hafs');
  mockOpen.mockClear();
});
afterEach(() => {
  mockRead = undefined;
});

test('loads cloud words before publishing its rewayah or any other document', async () => {
  const block = await blockWords('dk_words_warsh.db');
  const beforeTheme = useThemeStore.getState().themeMode;
  const pending = applySettingsDocuments({
    appearance: {themeMode: 'dark'},
    mushaf: {rewayah: 'warsh'},
  });
  await block.started;
  expect(mushaf.getState().rewayah).toBe('hafs');
  expect(cache.rewayah).toBe('hafs');
  expect(cache.getVerseWords('1:1')[0].text).toBe('dk_words.db');
  expect(useThemeStore.getState().themeMode).toBe(beforeTheme);
  block.release();
  const applied = await pending;
  expect(applied.mushaf.rewayah).toBe('warsh');
  expect(cache.getVerseWords('1:1')[0].text).toBe('dk_words_warsh.db');
  expect(mushaf.getState().rewayah).toBe(cache.rewayah);
});

test('same loaded reading is a no-op and does not reload SQLite', async () => {
  await applySettingsDocuments({mushaf: {rewayah: 'hafs'}});
  expect(mockOpen).not.toHaveBeenCalled();
});

test('cache failure leaves the old words, label and renderer intact and can retry', async () => {
  mockRead = async name => {
    if (name === 'dk_words_warsh.db') throw new Error('cache unavailable');
  };
  await expect(
    applySettingsDocuments({
      mushaf: {rewayah: 'warsh', mushafRenderer: 'dk_v2'},
    }),
  ).rejects.toThrow('cache unavailable');
  expect(mushaf.getState()).toMatchObject({
    rewayah: 'hafs',
    mushafRenderer: 'dk_v1',
  });
  expect(cache.rewayah).toBe('hafs');
  expect(cache.getVerseWords('1:1')[0].text).toBe('dk_words.db');
  mockRead = undefined;
  await applySettingsDocuments({mushaf: {rewayah: 'warsh'}});
  expect(mushaf.getState().rewayah).toBe('warsh');
});

test('QCF cache failure cannot force a Hafs label or publish the renderer', async () => {
  await cache.switchRewayah('warsh');
  mushaf.getState().setRewayah('warsh');
  mockRead = async name => {
    if (name === 'dk_words.db') throw new Error('Hafs unavailable');
  };
  await expect(
    applySettingsDocuments({mushaf: {mushafRenderer: 'qcf_v2'}}),
  ).rejects.toThrow('Hafs unavailable');
  expect(mushaf.getState()).toMatchObject({
    rewayah: 'warsh',
    mushafRenderer: 'dk_v1',
    showTajweed: true,
    showRewayahDiffs: true,
  });
  expect(cache.rewayah).toBe('warsh');
  expect(cache.getVerseWords('1:1')[0].text).toBe('dk_words_warsh.db');
});

test('an unloaded same reading must finish initialization before publication', async () => {
  await cache.resetDatabases();
  const block = await blockWords('dk_words.db');
  const pending = applySettingsDocuments({
    mushaf: {rewayah: 'hafs', mushafRenderer: 'dk_v2'},
  });
  await block.started;
  expect(cache.initialized).toBe(false);
  expect(mushaf.getState().mushafRenderer).toBe('dk_v1');
  block.release();
  await pending;
  expect(cache.initialized).toBe(true);
  expect(cache.getVerseWords('1:1')[0].text).toBe('dk_words.db');
  expect(mushaf.getState().mushafRenderer).toBe('dk_v2');
});

test('taxonomy-only reading does not publish a label without bundled words', async () => {
  await expect(
    applySettingsDocuments({mushaf: {rewayah: 'hisham'}}),
  ).rejects.toThrow('No text data bundled');
  expect(mushaf.getState().rewayah).toBe('hafs');
  expect(cache.rewayah).toBe('hafs');
});

test('QCF forces loaded Hafs before renderer publication, even with remote Warsh', async () => {
  await cache.switchRewayah('warsh');
  mushaf.getState().setRewayah('warsh');
  const block = await blockWords('dk_words.db');
  const pending = applySettingsDocuments({
    mushaf: {
      mushafRenderer: 'qcf_v2',
      rewayah: 'warsh',
      showRewayahDiffs: true,
    },
  });
  await block.started;
  expect(mushaf.getState()).toMatchObject({
    rewayah: 'warsh',
    mushafRenderer: 'dk_v1',
  });
  block.release();
  await pending;
  expect(mushaf.getState()).toMatchObject({
    rewayah: 'hafs',
    mushafRenderer: 'qcf_v2',
    showTajweed: false,
    showRewayahDiffs: false,
  });
  expect(cache.getVerseWords('1:1')[0].text).toBe('dk_words.db');
});

test('an obsolete account cannot commit a delayed cloud cache or document', async () => {
  const block = await blockWords('dk_words_warsh.db');
  let current = true;
  const pending = applySettingsDocuments(
    {mushaf: {rewayah: 'warsh'}},
    () => current,
  );
  const rejection = expect(pending).rejects.toThrow('superseded');
  await block.started;
  current = false;
  block.release();
  await rejection;
  expect(mushaf.getState().rewayah).toBe('hafs');
  expect(cache.rewayah).toBe('hafs');
});

test('invalidation at cache notification restores the selected cache without publishing cloud settings', async () => {
  let current = true;
  const unsubscribe = cache.subscribeCacheChanges(() => {
    if (cache.rewayah === 'warsh') current = false;
  });
  try {
    await expect(
      applySettingsDocuments({mushaf: {rewayah: 'warsh'}}, () => current),
    ).rejects.toThrow('superseded');
    expect(mushaf.getState().rewayah).toBe('hafs');
    expect(cache.rewayah).toBe('hafs');
    expect(cache.getVerseWords('1:1')[0].text).toBe('dk_words.db');
  } finally {
    unsubscribe();
  }
});

test('newer manual settings during cache loading are not overwritten', async () => {
  const block = await blockWords('dk_words_warsh.db');
  const pending = applySettingsDocuments({
    mushaf: {rewayah: 'warsh', showTranslation: true},
  });
  const rejection = expect(pending).rejects.toThrow('superseded');
  await block.started;
  mushaf.getState().toggleTranslation();
  block.release();
  await rejection;
  expect(mushaf.getState()).toMatchObject({
    rewayah: 'hafs',
    showTranslation: false,
  });
  expect(cache.rewayah).toBe('hafs');
});

test('a queued manual rewayah switch wins with its own complete cache', async () => {
  const block = await blockWords('dk_words_warsh.db');
  const remote = applySettingsDocuments({mushaf: {rewayah: 'warsh'}});
  await block.started;
  const manual = cache
    .switchRewayah('qalun')
    .then(() => mushaf.getState().setRewayah('qalun'));
  block.release();
  await Promise.all([remote, manual]);
  expect(mushaf.getState().rewayah).toBe('qalun');
  expect(cache.rewayah).toBe('qalun');
  expect(cache.getVerseWords('1:1')[0].text).toBe('dk_words_qaloon.db');
});
