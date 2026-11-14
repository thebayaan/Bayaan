// @ai-generated
/**
 * The player header draws the surah name with SurahNameQCF from the shared
 * Mushaf font provider. A mount reads no font file (it used to call `useFonts`,
 * which read the 1.1 MB file again at each mount). Until the fonts load, the
 * header shows the Arabic name in text.
 */

import React, {act} from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

const mockFontMgr = {current: null as object | null};
const mockUseFonts = jest.fn((): object | null => null);
const mockBuilderFontMgrs: unknown[] = [];

jest.mock('@shopify/react-native-skia', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    Canvas: MockView,
    Group: MockView,
    Paragraph: () => null,
    BlendMode: {SrcIn: 5},
    useFonts: () => mockUseFonts(),
    Skia: {
      Color: (c: string) => c,
      Paint: () => ({setColorFilter: () => undefined}),
      ColorFilter: {MakeBlend: () => ({})},
      ParagraphBuilder: {
        Make: (_style: unknown, fontMgr: unknown) => {
          mockBuilderFontMgrs.push(fontMgr);
          return {
            pushStyle: () => undefined,
            addText: () => undefined,
            pop: () => undefined,
            build: () => ({
              layout: () => undefined,
              getLongestLine: () => 120,
              getHeight: () => 30,
            }),
          };
        },
      },
    },
  };
});

jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => mockFontMgr.current,
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {text: '#111111'}}}),
}));
jest.mock('@/hooks/useGlassProps', () => ({
  USE_GLASS: false,
  useGlassColorScheme: () => 'light',
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({setSheetMode: () => undefined}),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));
jest.mock('@/hooks/usePlayerA11y', () => ({
  usePlayerA11y: () => ({closePlayer: {}, moreOptions: {}}),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (state: unknown) => unknown) =>
    select({queue: {tracks: [{surahId: '1'}], currentIndex: 0}}),
}));
jest.mock('@/components/FrostedView', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {FrostedView: MockView};
});
jest.mock('expo-glass-effect', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {GlassView: MockView, isLiquidGlassAvailable: () => false};
});
jest.mock('expo-symbols', () => ({SymbolView: () => null}));
jest.mock('@expo/vector-icons', () => ({
  Entypo: () => null,
  Feather: () => null,
}));

import {Header} from '../Header';

function render(): TestRenderer.ReactTestRenderer {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Header onOptionsPress={() => undefined} />);
  });
  return renderer;
}

function texts(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll(node => (node.type as unknown) === Text)
    .map(node => String(node.props.children));
}

beforeEach(() => {
  mockFontMgr.current = null;
  mockUseFonts.mockClear();
  mockBuilderFontMgrs.length = 0;
});

it('draws the surah name with the shared provider, and a mount reads no font', () => {
  const shared = {name: 'preloaded'};
  mockFontMgr.current = shared;

  for (let mount = 0; mount < 3; mount += 1) {
    const renderer = render();
    expect(texts(renderer)).toEqual([]);
    act(() => renderer.unmount());
  }

  expect(mockUseFonts).not.toHaveBeenCalled();
  expect(mockBuilderFontMgrs).toEqual([shared, shared, shared]);
});

it('shows the Arabic name in text until the fonts load', () => {
  const renderer = render();

  expect(texts(renderer)).toEqual(['الفاتحة']);
  expect(mockBuilderFontMgrs).toEqual([]);
});
