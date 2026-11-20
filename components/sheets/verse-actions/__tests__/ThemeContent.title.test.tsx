/**
 * The verse sheet's Theme screen in the English UI keeps the English title
 * even where the passage has an Arabic one (ThemeContent.title.ar.test.tsx is
 * the Arabic UI).
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text} from 'react-native';

// The sheet's lists and footers as plain views: no sheet here.
jest.mock('../sheetGestures');
jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'en'}],
}));
jest.mock('@/data/quran-themes.ar.json', () => ({
  themes: {'2:255': 'صفات الله وآية الكرسي'},
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {getOrderedVerseKeysForPage: () => []},
}));
jest.mock('../verseUnitScreens', () => ({rewayahThemePassage: jest.fn()}));
jest.mock('react-native-actions-sheet', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', textTertiary: '#888888'},
    },
  }),
}));

import {ThemeContent} from '../ThemeContent';

describe('ThemeContent in the English UI', () => {
  it('shows the English title of a passage that also has an Arabic one', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ThemeContent
          surahNumber={2}
          ayahNumber={255}
          onBack={() => undefined}
        />,
      );
    });
    const texts = renderer.root
      .findAll(node => (node.type as unknown) === Text)
      .map(node => [node.props.children].flat().join(''));
    expect(texts).toContain('Allah\'s attributes and "Ayat-al-Kursi"');
    expect(texts).not.toContain('صفات الله وآية الكرسي');
  });
});
