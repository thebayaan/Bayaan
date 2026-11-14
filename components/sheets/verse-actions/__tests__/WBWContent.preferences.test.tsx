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

// @ai-start
describe('a long-press on a word', () => {
  const grid = () => {
    if (!renderer) throw new Error('nothing rendered');
    return renderer.root.find(node => Object.is(node.type, WBWVerseView));
  };

  it('studies the word when the sheet asks for it', async () => {
    const onOpenWord = jest.fn();
    await act(async () => {
      renderer = TestRenderer.create(
        <WBWContent
          surahNumber={2}
          ayahNumber={255}
          rewayah="hafs"
          onOpenWord={onOpenWord}
          onBack={() => undefined}
        />,
      );
    });
    act(() => grid().props.onWordPress(3));
    expect(onOpenWord).toHaveBeenCalledWith({verseKey: '2:255', position: 3});
    // Not lifted: the sheet moves on to Word Study.
    expect(grid().props.selectedWordPosition).toBeNull();
  });

  it("in another rewayah, studies only the verse's own words", async () => {
    // Warsh 1:6 holds Hafs 1:7 words 1-4; the grid draws all of Hafs 1:7.
    const fixture =
      require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
        ids: number[];
        locations: string[];
        texts: Record<'warsh', string[]>;
      };
    const {buildRewayahVerseUnits} =
      require('@/services/mushaf/RewayahVerseUnits') as typeof import('@/services/mushaf/RewayahVerseUnits');
    const model = buildRewayahVerseUnits(
      'warsh',
      fixture.ids.map((id, i) => {
        const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
        return {id, surah, ayah, word, text: fixture.texts.warsh[i]};
      }),
      'warsh@test',
    );
    const unit = model.unitByKey('1:6');
    if (!unit) throw new Error('no Warsh 1:6 in the fixture');
    const onOpenWord = jest.fn();
    await act(async () => {
      renderer = TestRenderer.create(
        <WBWContent
          surahNumber={1}
          ayahNumber={7}
          rewayah="warsh"
          unitStart={{model, unit}}
          onOpenWord={onOpenWord}
          onBack={() => undefined}
        />,
      );
    });
    // A word of Warsh 1:6 opens Word Study.
    act(() => grid().props.onWordPress(2));
    expect(onOpenWord).toHaveBeenCalledWith({verseKey: '1:7', position: 2});
    // A word of Warsh 1:7 (Hafs 1:7 word 6) is only lifted.
    onOpenWord.mockClear();
    act(() => grid().props.onWordPress(6));
    expect(onOpenWord).not.toHaveBeenCalled();
    expect(grid().props.selectedWordPosition).toBe(6);
  });

  it('lifts the word, and lets it go, without it', async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <WBWContent
          surahNumber={2}
          ayahNumber={255}
          rewayah="hafs"
          onBack={() => undefined}
        />,
      );
    });
    act(() => grid().props.onWordPress(3));
    expect(grid().props.selectedWordPosition).toBe(3);
    act(() => grid().props.onWordPress(3));
    expect(grid().props.selectedWordPosition).toBeNull();
  });
});
// @ai-end
