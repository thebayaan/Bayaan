// @ai-generated
// Arabic defaults must not override explicit choices during hydration/reloads.
const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    mockStorage.delete(key);
  },
}));

async function loadStores(showEnglishByDefault: boolean) {
  jest.doMock('@/i18n/language', () => ({
    defaultShowEnglishReadingAids: showEnglishByDefault,
    defaultShowTransliteration: showEnglishByDefault,
  }));
  let mushaf!: typeof import('../mushafSettingsStore').useMushafSettingsStore;
  let adhkar!: typeof import('../adhkarSettingsStore').useAdhkarSettingsStore;
  jest.isolateModules(() => {
    mushaf = require('../mushafSettingsStore').useMushafSettingsStore;
    adhkar = require('../adhkarSettingsStore').useAdhkarSettingsStore;
  });
  await Promise.all([mushaf.persist.rehydrate(), adhkar.persist.rehydrate()]);
  return {mushaf, adhkar};
}

beforeEach(() => mockStorage.clear());

it.each([false, true])(
  'uses the language default (%s) only for fresh settings',
  async showEnglishByDefault => {
    const {mushaf, adhkar} = await loadStores(showEnglishByDefault);
    expect(mushaf.getState()).toMatchObject({
      showTranslation: showEnglishByDefault,
      showTransliteration: false,
      wbwShowTranslation: showEnglishByDefault,
      wbwShowTransliteration: false,
    });
    expect(adhkar.getState()).toMatchObject({
      showTranslation: showEnglishByDefault,
      showTransliteration: showEnglishByDefault,
    });
  },
);

it('lets Arabic readers enable every reading aid and retains it after reload', async () => {
  const {mushaf, adhkar} = await loadStores(false);
  mushaf.getState().toggleTranslation();
  mushaf.getState().toggleTransliteration();
  mushaf.getState().toggleWBWTranslation();
  mushaf.getState().toggleWBWTransliteration();
  adhkar.getState().toggleTranslation();
  adhkar.getState().toggleTransliteration();

  const reloaded = await loadStores(false);
  expect(reloaded.mushaf.getState()).toMatchObject({
    showTranslation: true,
    showTransliteration: true,
    wbwShowTranslation: true,
    wbwShowTransliteration: true,
  });
  expect(reloaded.adhkar.getState()).toMatchObject({
    showTranslation: true,
    showTransliteration: true,
  });
});

it.each([false, true])(
  'preserves saved choices (%s) when the interface language changes',
  async enabled => {
    const {mushaf, adhkar} = await loadStores(enabled);
    const choices = {showTranslation: enabled, showTransliteration: enabled};
    mushaf.setState({
      ...choices,
      wbwShowTranslation: enabled,
      wbwShowTransliteration: enabled,
    });
    adhkar.setState(choices);

    const reloaded = await loadStores(!enabled);
    expect(reloaded.mushaf.getState()).toMatchObject({
      ...choices,
      wbwShowTranslation: enabled,
      wbwShowTransliteration: enabled,
    });
    expect(reloaded.adhkar.getState()).toMatchObject(choices);
  },
);

it('uses Arabic defaults for missing legacy word-by-word preferences without changing saved verse preferences', async () => {
  mockStorage.set(
    'mushaf-settings',
    JSON.stringify({
      version: 7,
      state: {showTranslation: true, showTransliteration: true},
    }),
  );
  const {mushaf} = await loadStores(false);
  expect(mushaf.getState()).toMatchObject({
    showTranslation: true,
    showTransliteration: true,
    wbwShowTranslation: false,
    wbwShowTransliteration: false,
  });
});
