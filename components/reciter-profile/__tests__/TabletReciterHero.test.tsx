// @ai-generated
import React from 'react';
import {StyleSheet} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {TabletReciterHero} from '../components/TabletReciterHero';
import type {Reciter} from '@/data/reciterData';

let mockWindowWidth = 1032;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({width: mockWindowWidth, isTablet: true}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#000000', textSecondary: '#666666', background: '#fff'},
      fonts: {bold: 'b', semiBold: 's'},
    },
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('expo-router', () => ({Link: {AppleZoomTarget: () => null}}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('@/i18n/format', () => ({
  getReciterDisplayName: (r: {name: string}) => r.name,
}));
jest.mock('@/components/ReciterImage', () => {
  const {View} = jest.requireActual('react-native');
  return {
    ReciterImage: ({style}: {style: unknown}) => (
      <View testID="photo" style={style} />
    ),
  };
});
jest.mock('@/components/Icons', () => ({
  DownloadIcon: () => null,
  PlayIcon: () => null,
  ShuffleIcon: () => null,
}));
jest.mock('@/components/CircularProgress', () => ({
  CircularProgress: () => null,
}));
jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));

const reciter = {
  id: 'r1',
  name: 'Mishary Alafasy',
  image_url: null,
  rewayat: [{id: 'h', surah_list: [1, 2, 3]}],
} as unknown as Reciter;

function render(
  overrides: Partial<React.ComponentProps<typeof TabletReciterHero>> = {},
) {
  const props = {
    reciter,
    paddingTop: 8,
    margin: 32,
    onPlayPress: jest.fn(),
    onShufflePress: jest.fn(),
    onFavoritePress: jest.fn(),
    onDownloadAllPress: jest.fn(),
    isFavoriteReciter: false,
    ...overrides,
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<TabletReciterHero {...props} />);
  });
  return {renderer, props};
}

const photoSize = (renderer: TestRenderer.ReactTestRenderer) =>
  StyleSheet.flatten(
    renderer.root.find(
      n => n.props.testID === 'photo' && typeof n.type === 'string',
    ).props.style,
  ).width;

beforeEach(() => {
  mockWindowWidth = 1032;
});

describe('TabletReciterHero', () => {
  it('uses the 240pt photo on a 13-inch iPad', () => {
    expect(photoSize(render().renderer)).toBe(240);
  });

  it('uses the 200pt photo on an iPad mini', () => {
    mockWindowWidth = 744;
    expect(photoSize(render().renderer)).toBe(200);
  });

  it('wires Play all, Shuffle, Favorite and Download', () => {
    const {renderer, props} = render({isFavoriteReciter: true});
    const buttons = renderer.root.findAll(
      n =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        typeof n.type !== 'string',
    );
    expect(buttons).toHaveLength(4);
    buttons.forEach(b => act(() => b.props.onPress()));
    expect(props.onPlayPress).toHaveBeenCalledTimes(1);
    expect(props.onShufflePress).toHaveBeenCalledTimes(1);
    expect(props.onFavoritePress).toHaveBeenCalledTimes(1);
    expect(props.onDownloadAllPress).toHaveBeenCalledTimes(1);
    const favorite = buttons.find(
      b => b.props.accessibilityLabel === 'player:reciterProfile.favorite',
    );
    expect(favorite?.props.accessibilityState).toEqual({selected: true});
  });

  it('shows the surah and rewayah counts', () => {
    const {renderer} = render();
    const texts = renderer.root
      .findAll(n => (n.type as unknown) === 'Text')
      .map(n => n.props.children);
    expect(texts).toContain(
      'reciterProfile.surahCount · reciterProfile.rewayatCount',
    );
  });
});
