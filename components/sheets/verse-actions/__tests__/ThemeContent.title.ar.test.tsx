/**
 * The verse sheet's Theme screen in the Arabic UI: the passage's Arabic title,
 * and the English title for a passage the Arabic file has no title for. The
 * app language is fixed when the app starts, so this runs in its own file
 * (ThemeContent.title.test.tsx is the English UI).
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text} from 'react-native';

// The sheet's lists and footers as plain views: no sheet here.
jest.mock('../sheetGestures');
jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'ar'}],
}));
// Real English passages; Arabic titles for 2:255 only.
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

function renderTexts(surahNumber: number, ayahNumber: number): string[] {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ThemeContent
        surahNumber={surahNumber}
        ayahNumber={ayahNumber}
        onBack={() => undefined}
      />,
    );
  });
  return renderer.root
    .findAll(node => (node.type as unknown) === Text)
    .map(node => [node.props.children].flat().join(''));
}

describe('ThemeContent in the Arabic UI', () => {
  it('shows the Arabic title of the passage', () => {
    const texts = renderTexts(2, 255);
    expect(texts).toContain('صفات الله وآية الكرسي');
    expect(texts).not.toContain('Allah\'s attributes and "Ayat-al-Kursi"');
  });

  it('shows the English title of a passage with no Arabic title', () => {
    expect(renderTexts(1, 3)).toContain(
      'Supplication to Allah for guidance taught by Allah Himself',
    );
  });
});
