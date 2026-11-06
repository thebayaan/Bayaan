import React from 'react';
import {Text, View} from 'react-native';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import {AdhkarQuranPassage} from '../AdhkarQuranPassage';

const mockStatus = {current: 'ready'};
const mockRequests: Array<{keys: readonly string[]; rewayah: string}> = [];
const mockWordsRewayahs: Array<string | undefined> = [];

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false, colors: {text: '#111111'}}}),
}));

jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({}),
}));

jest.mock('@/store/mushafSettingsStore', () => ({
  getDkFontFamily: () => 'DigitalKhattV2',
  useMushafSettingsStore: (
    select: (state: Record<string, unknown>) => unknown,
  ) =>
    select({
      mushafRenderer: 'dk_v2',
      arabicTextWeight: 'normal',
      showAllahNameHighlight: false,
      allahNameHighlightColor: 'default',
    }),
}));

jest.mock('@/constants/mushafAllahHighlight', () => ({
  getAllahNameHighlightColorHex: () => '#ff0000',
}));

jest.mock('@/components/share/useRewayahVerseTexts', () => ({
  useRewayahVerseTexts: (keys: readonly string[], rewayah: string) => {
    mockRequests.push({keys, rewayah});
    return {status: mockStatus.current};
  },
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getVerseWords: (verseKey: string, rewayah?: string) => {
      mockWordsRewayahs.push(rewayah);
      return [
        {text: 'قُلْ', verseKey, wordPositionInVerse: 1},
        {text: '۝١', verseKey, wordPositionInVerse: 2},
      ];
    },
  },
}));

jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText',
  () => {
    const {Text: MockText} = jest.requireActual('react-native');
    return {
      __esModule: true,
      default: ({text, textAlign}: {text: string; textAlign?: string}) => (
        <MockText testID="skia" nativeID={textAlign}>
          {text}
        </MockText>
      ),
    };
  },
);

// The renderer's own React types differ from the app's.
const VIEW = View as never;
const TEXT = Text as never;

function render(): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <AdhkarQuranPassage
        span={{surah: 112, ayahFrom: 1, ayahTo: 1}}
        fallbackText="قُلْ هُوَ اللَّهُ أَحَدٌ"
        fallbackStyle={{fontSize: 20}}
        fontSize={20}
        color="#111111"
        horizontalPadding={0}
        textAlign="center"
      />,
    );
  });
  if (!renderer) throw new Error('not rendered');
  const wrapper = renderer.root.findAll(
    node => node.type === VIEW && typeof node.props.onLayout === 'function',
  )[0];
  if (wrapper) {
    act(() => wrapper.props.onLayout({nativeEvent: {layout: {width: 320}}}));
  }
  return renderer;
}

describe('AdhkarQuranPassage', () => {
  beforeEach(() => {
    mockStatus.current = 'ready';
    mockRequests.length = 0;
    mockWordsRewayahs.length = 0;
  });

  it('gives the canvas the passage text for screen readers', () => {
    const renderer = render();
    const wrapper = renderer.root.findAll(
      node => node.type === VIEW && node.props.accessible === true,
    );
    expect(wrapper).toHaveLength(1);
    expect(wrapper[0].props.accessibilityRole).toBe('text');
    expect(wrapper[0].props.accessibilityLabel).toBe(
      'قُلْ هُوَ اللَّهُ أَحَدٌ',
    );
  });

  it('draws the DK words with the requested alignment', () => {
    const renderer = render();
    const skia = renderer.root
      .findAll(node => node.type === TEXT)
      .filter(node => node.props.testID === 'skia');
    expect(skia).toHaveLength(1);
    expect(skia[0].props.children).toBe('قُلْ ۝١');
    expect(skia[0].props.nativeID).toBe('center');
  });

  it('keeps the place with an invisible copy while the words load', () => {
    mockStatus.current = 'loading';
    const renderer = render();
    const texts = renderer.root.findAll(node => node.type === TEXT);
    expect(texts).toHaveLength(1);
    expect(texts[0].props.children).toBe('قُلْ هُوَ اللَّهُ أَحَدٌ');
    expect(texts[0].props.style).toEqual([{fontSize: 20}, {opacity: 0}]);
    expect(
      renderer.root.findAll(
        node => node.type === VIEW && node.props.accessible === true,
      ),
    ).toHaveLength(1);
  });

  it('shows the row text visibly when the words cannot load', () => {
    mockStatus.current = 'unavailable';
    const renderer = render();
    const texts = renderer.root.findAll(node => node.type === TEXT);
    expect(texts).toHaveLength(1);
    expect(texts[0].props.style).toEqual({fontSize: 20});
  });

  it('reads Hafs words whatever rewayah the mushaf is on', () => {
    render();
    expect(mockRequests.length).toBeGreaterThan(0);
    expect(mockRequests.every(r => r.rewayah === 'hafs')).toBe(true);
    expect(mockWordsRewayahs.length).toBeGreaterThan(0);
    expect(mockWordsRewayahs.every(r => r === 'hafs')).toBe(true);
  });
});
