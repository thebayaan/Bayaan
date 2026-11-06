// @ai-generated
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import i18n from 'i18next';

jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'ar'}],
}));
jest.mock('react-native-actions-sheet', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', textSecondary: '#666666'},
    },
  }),
}));
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/WBWVerseView',
  () => ({WBWVerseView: () => null}),
);
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => null,
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: true,
    isRewayahReady: () => true,
    subscribeCacheChanges: () => () => undefined,
  },
}));

import {WBWContent} from '../WBWContent';
import {WBWVerseView} from '@/components/player/v2/PlayerContent/QuranView/WBWVerseView';
import {currentLanguage} from '@/i18n/language';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

beforeAll(async () => {
  await i18n.changeLanguage('ar');
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  'honors saved WBW translation=%s and transliteration=%s in Arabic',
  async (showTranslation, showTransliteration) => {
    expect(currentLanguage).toBe('ar');
    expect(i18n.language).toBe('ar');
    useMushafSettingsStore.setState({
      wbwShowTranslation: showTranslation,
      wbwShowTransliteration: showTransliteration,
      // The standalone sheet must use its own word preferences even when
      // inline WBW is off and the whole-verse preferences differ.
      showWBW: false,
      showTranslation: !showTranslation,
      showTransliteration: !showTransliteration,
    });

    await act(async () => {
      renderer = TestRenderer.create(
        <WBWContent
          surahNumber={1}
          ayahNumber={1}
          rewayah="hafs"
          onBack={() => undefined}
        />,
      );
    });

    expect(
      renderer!.root.find(node => Object.is(node.type, WBWVerseView)).props,
    ).toMatchObject({
      showTranslation,
      showTransliteration,
    });
  },
);
