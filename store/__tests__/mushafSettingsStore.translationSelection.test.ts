// The persist migration to version 20 moves a translation selection saved
// before the switch to QF translations (spec 4.7). It runs at hydration,
// before content sync, so the engine only ever sees current ids.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// mockEngineTranslations: Bayaan's QF translations (true) or a fork's own
// provider (false).
let mockEngineTranslations = true;
jest.mock('@/services/content/contentScope', () => ({
  isEngineManagingTranslations: () => mockEngineTranslations,
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {useMushafSettingsStore} from '../mushafSettingsStore';

function migrate(state: Record<string, unknown>, version: number): unknown {
  const options = useMushafSettingsStore.persist.getOptions();
  if (!options.migrate) throw new Error('store has no migrate function');
  return options.migrate({...state}, version);
}

function selectionAfter(saved: string, version = 19): unknown {
  const state = migrate({selectedTranslationId: saved}, version) as Record<
    string,
    unknown
  >;
  return state.selectedTranslationId;
}

describe('mushaf settings persist migration: translation selection', () => {
  afterEach(() => {
    mockEngineTranslations = true;
  });

  it.each([
    ['saheeh', '20'],
    ['en.pickthall', '19'],
    ['zh.jian', '56'],
    ['zh.majian', '56'],
    ['en.asad', 'clear-quran'],
    ['clear-quran', 'clear-quran'],
    ['131', '131'],
  ])('with the engine, maps %s to %s', (saved, expected) => {
    expect(selectionAfter(saved)).toBe(expected);
  });

  it.each([
    ['saheeh', 'clear-quran'],
    ['en.pickthall', 'en.pickthall'],
    ['clear-quran', 'clear-quran'],
  ])('for a fork with its own provider, maps %s to %s', (saved, expected) => {
    mockEngineTranslations = false;
    expect(selectionAfter(saved)).toBe(expected);
  });

  it('moves a pre-v6 install (forced to saheeh) on to QF 20', () => {
    expect(selectionAfter('en.pickthall', 5)).toBe('20');
  });

  it('is the current version, and adds no selection a state lacks', () => {
    expect(useMushafSettingsStore.persist.getOptions().version).toBe(20);
    expect(migrate({}, 19)).not.toHaveProperty('selectedTranslationId');
  });

  it('remaps on hydration, and again when the remapped write was lost', async () => {
    const saved = JSON.stringify({
      state: {selectedTranslationId: 'saheeh'},
      version: 19,
    });
    await AsyncStorage.setItem('mushaf-settings', saved);
    await useMushafSettingsStore.persist.rehydrate();
    expect(useMushafSettingsStore.getState().selectedTranslationId).toBe('20');

    // A lost write leaves version 19 on disk: the next launch remaps again.
    useMushafSettingsStore.setState({selectedTranslationId: 'clear-quran'});
    await new Promise(resolve => setTimeout(resolve, 0));
    await AsyncStorage.setItem('mushaf-settings', saved);
    await useMushafSettingsStore.persist.rehydrate();
    expect(useMushafSettingsStore.getState().selectedTranslationId).toBe('20');

    const written = JSON.parse(
      (await AsyncStorage.getItem('mushaf-settings')) ?? '{}',
    );
    expect(written).toMatchObject({
      version: 20,
      state: {selectedTranslationId: '20'},
    });
  });
});
