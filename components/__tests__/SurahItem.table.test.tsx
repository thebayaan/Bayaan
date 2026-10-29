// @ai-generated
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {SurahItem, SurahTableHeader} from '../SurahItem';
import type {Surah} from '@/data/surahData';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000000',
        textSecondary: '#666666',
        background: '#ffffff',
        card: '#eeeeee',
        border: '#dddddd',
      },
      fonts: {regular: 'r'},
    },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('@/i18n/format', () => ({
  getSurahDisplayName: (s: {name: string}) => s.name,
  getSurahMeaning: () => 'The Opener',
  localizeDigits: (n: number) => String(n),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (state: unknown) => unknown) =>
    select({
      playback: {state: 'paused'},
      queue: {currentIndex: -1, tracks: []},
    }),
}));
jest.mock('@/services/player/store/downloadSelectors', () => ({
  useDownloadProgress: () => 0,
  useIsDownloaded: () => false,
  useIsDownloadedWithRewayat: () => false,
  useIsDownloading: () => false,
}));
jest.mock('@/components/Icons', () => {
  const {Text: MockText} = jest.requireActual('react-native');
  return {
    HeartIcon: () => null,
    MakkahIcon: () => <MockText>place-chip</MockText>,
    MadinahIcon: () => <MockText>place-chip</MockText>,
  };
});
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
}));
jest.mock('expo-haptics', () => ({impactAsync: jest.fn()}));
jest.mock('../NowPlayingIndicator', () => ({NowPlayingIndicator: () => null}));
jest.mock('@/components/GradientText', () => ({GradientText: () => null}));
jest.mock('@/components/CircularProgress', () => ({
  CircularProgress: () => null,
}));

const fatihah = {
  id: 1,
  name: 'Al-Fatihah',
  verses_count: 7,
  revelation_place: 'makkah',
} as unknown as Surah;

function texts(element: Parameters<typeof TestRenderer.create>[0]) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  const text: unknown = Text;
  return renderer.root
    .findAll(n => n.type === text)
    .map(n => n.props.children)
    .flat();
}

describe('SurahItem table layout', () => {
  it('keeps the place chip and no columns on phones', () => {
    const shown = texts(
      <SurahItem
        item={fatihah}
        onPress={jest.fn()}
        onOptionsPress={jest.fn()}
      />,
    );
    expect(shown).toContain('place-chip');
    expect(shown).not.toContain('7');
  });

  it('shows Revelation and Verses columns instead of the chip', () => {
    const shown = texts(
      <SurahItem
        item={fatihah}
        onPress={jest.fn()}
        onOptionsPress={jest.fn()}
        tableColumns
      />,
    );
    expect(shown).not.toContain('place-chip');
    expect(shown).toEqual(expect.arrayContaining(['surahItem.makkah', '7']));
  });

  it('labels the same columns in the header', () => {
    expect(texts(<SurahTableHeader />)).toEqual([
      'surahItem.columnSurah',
      'surahItem.columnRevelation',
      'surahItem.columnVerses',
    ]);
  });
});
