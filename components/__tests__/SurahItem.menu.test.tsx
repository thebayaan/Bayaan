// @ai-generated
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {SurahItem} from '../SurahItem';
import {SurahOptionsContext} from '@/components/sheets/options/SurahOptionsContext';
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

let mockIsTablet = true;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: mockIsTablet}),
}));

const fatihah = {
  id: 1,
  name: 'Al-Fatihah',
  verses_count: 7,
  revelation_place: 'makkah',
} as unknown as Surah;

const MockMenu = jest.fn(({children}: {children?: React.ReactNode}) => (
  <>{children}</>
));
const context = {
  build: (surah: Surah) => ({surah, reciterId: 'r1', rewayatId: 'w1'}),
  Menu: MockMenu,
};

function mount(onOptionsPress = jest.fn(), onLongPress?: () => void) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <SurahOptionsContext.Provider value={context}>
        <SurahItem
          item={fatihah}
          onPress={jest.fn()}
          onOptionsPress={onOptionsPress}
          onLongPress={onLongPress}
          reciterId="r1"
        />
      </SurahOptionsContext.Provider>,
    );
  });
  return renderer;
}

const menuTriggers = () =>
  MockMenu.mock.calls.map(([props]) => (props as {trigger?: string}).trigger);

beforeEach(() => {
  MockMenu.mockClear();
  mockIsTablet = true;
});

describe('SurahItem native options menu', () => {
  it('opens the options from a menu on tablets, not the sheet', () => {
    const onOptionsPress = jest.fn();
    const r = mount(onOptionsPress);
    expect(menuTriggers()).toEqual(expect.arrayContaining(['longPress']));
    expect(
      MockMenu.mock.calls.some(
        ([props]) => (props as {layout?: string}).layout === 'overlay',
      ),
    ).toBe(true);
    const more = r.root.findAll(
      n => n.props.accessibilityLabel === 'surahItem.moreOptions',
    )[0];
    expect(more.props.onPress).toBeUndefined();
    expect(onOptionsPress).not.toHaveBeenCalled();
  });

  it('keeps a row long press that does something else', () => {
    mount(jest.fn(), jest.fn());
    expect(menuTriggers()).not.toContain('longPress');
  });

  it('opens the options from a menu on phones too, without a row menu', () => {
    mockIsTablet = false;
    const onOptionsPress = jest.fn();
    const r = mount(onOptionsPress);
    expect(menuTriggers()).not.toContain('longPress');
    const more = r.root.findAll(
      n => n.props.accessibilityLabel === 'surahItem.moreOptions',
    )[0];
    expect(more.props.onPress).toBeUndefined();
    expect(onOptionsPress).not.toHaveBeenCalled();
  });
});
