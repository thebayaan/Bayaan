// @ai-generated
/**
 * VerseHitRow with SkiaVerseText mocked: the reference, the match badge, the
 * spoken label (with the snippet's plain text), the press, and the tinted
 * ranges handed to the Skia text.
 */
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {VerseHitRow} from '../VerseHitRow';
import type {QuranVerseHit} from '@/utils/search/quranSearch';

const mockSkia = jest.fn((_props: Record<string, unknown>) => null);
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText',
  () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => mockSkia(props),
  }),
);

const mockWords = [
  {text: 'بِسْمِ', verseKey: '1:1', wordPositionInVerse: 1},
  {text: 'ٱللَّهِ', verseKey: '1:1', wordPositionInVerse: 2},
  {text: 'ٱلرَّحْمَٰنِ', verseKey: '1:1', wordPositionInVerse: 3},
  {text: 'ٱلرَّحِيمِ', verseKey: '1:1', wordPositionInVerse: 4},
];
jest.mock('@/hooks/useRewayahWords', () => ({
  useRewayahWords: () => ({words: mockWords, status: 'ready'}),
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({useMushafFontMgr: () => ({})}));
jest.mock('@/store/mushafSettingsStore', () => ({
  getDkFontFamily: () => 'DigitalKhattV2',
  useMushafSettingsStore: (
    select: (state: Record<string, unknown>) => unknown,
  ) => select({mushafRenderer: 'dk_v2', arabicTextWeight: 'normal'}),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({width: 390, isTablet: false}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#000000', textSecondary: '#666666', background: '#fff'},
      fonts: {semiBold: 's', medium: 'm'},
    },
  }),
}));

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const hit: QuranVerseHit = {
  verseIndex: 0,
  verseKey: '1:1',
  matches: [
    {position: 2, length: 1},
    {position: 4, length: 1},
  ],
  score: 130,
};

function render(props: Partial<React.ComponentProps<typeof VerseHitRow>> = {}) {
  const onPress = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <VerseHitRow hit={hit} onPress={onPress} {...props} />,
    );
  });
  const root = (renderer as TestRenderer.ReactTestRenderer).root;
  // The snippet measures its width before the Skia text is drawn.
  act(() => {
    root
      .findAll(node => typeof node.props.onLayout === 'function')
      .forEach(node =>
        node.props.onLayout({nativeEvent: {layout: {width: 320}}}),
      );
  });
  return {root, onPress};
}

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  mockSkia.mockClear();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

function textsOf(root: TestRenderer.ReactTestInstance): unknown[] {
  const text: unknown = Text;
  return root.findAll(node => node.type === text).map(n => n.props.children);
}

describe('VerseHitRow', () => {
  it('names the ayah and counts its matches', () => {
    const {root} = render();
    const texts = textsOf(root);
    expect(texts).toContain('Al-Fatihah 1:1');
    expect(texts).toContain('2 matches');
  });

  it('uses the label the surface gives', () => {
    const {root} = render({label: 'Al-Fatihah 1:1 · Warsh'});
    expect(textsOf(root)).toContain('Al-Fatihah 1:1 · Warsh');
  });

  it('speaks the reference and the plain snippet text', () => {
    const {root} = render();
    const button = root.findByProps({accessibilityRole: 'button'});
    expect(button.props.accessibilityLabel).toBe(
      `Al-Fatihah 1:1: ${mockWords.map(w => w.text).join(' ')}`,
    );
    expect(button.props.accessibilityHint).toBe('Opens the ayah in the Mushaf');
  });

  it('hands the matched words to the Skia text as tinted ranges', () => {
    render();
    const props = mockSkia.mock.calls[mockSkia.mock.calls.length - 1][0];
    expect(props).toMatchObject({
      rewayah: 'hafs',
      words: mockWords,
      width: 320,
    });
    const start2 = mockWords[0].text.length + 1;
    const start4 =
      start2 + mockWords[1].text.length + 1 + mockWords[2].text.length + 1;
    expect(props.highlightRanges).toEqual([
      {start: start2, end: start2 + mockWords[1].text.length - 1},
      {start: start4, end: start4 + mockWords[3].text.length - 1},
    ]);
    expect(typeof props.highlightColor).toBe('string');
  });

  it('opens the hit on press', () => {
    const {root, onPress} = render();
    act(() => root.findByProps({accessibilityRole: 'button'}).props.onPress());
    expect(onPress).toHaveBeenCalledWith(hit);
  });
});
