// @ai-generated
/**
 * The Word Study header word (WordHeaderText.tsx): the mushaf's own slots
 * joined, coloured slot by slot as the word-by-word grid colours a word
 * (the Allah name whole, else its tajweed at the slot's own offset),
 * centred in the measured width, with a stroke paragraph for a heavier
 * text weight; React Native Text in the DigitalKhatt face until the font
 * manager is ready. Skia is a recording paragraph builder; the tajweed
 * aligner returns fixed rules.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text, View} from 'react-native';
import {tajweedColors} from '@/constants/tajweedColors';

interface MockStyle {
  color: string;
  fontFamilies: string[];
  fontSize: number;
}
interface MockBuild {
  style: Record<string, unknown>;
  stroked: boolean;
  chars: {char: string; color: string}[];
  widths: number[];
}
const mockBuilds: MockBuild[] = [];

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: (props: {children?: unknown}) => props.children ?? null,
  Paragraph: () => null,
  Skia: {
    Color: (c: string) => c,
    Paint: () => ({
      setAntiAlias: () => undefined,
      setColor: () => undefined,
      setStyle: () => undefined,
      setStrokeWidth: () => undefined,
      setStrokeCap: () => undefined,
      setStrokeJoin: () => undefined,
    }),
    ParagraphBuilder: {
      Make: (style: Record<string, unknown>) => {
        const stack: MockStyle[] = [];
        const build: MockBuild = {style, stroked: false, chars: [], widths: []};
        return {
          pushStyle: (s: MockStyle, paint?: unknown) => {
            if (paint) build.stroked = true;
            stack.push(s);
          },
          pop: () => stack.pop(),
          addText: (text: string) => {
            for (const char of text) {
              build.chars.push({char, color: stack[stack.length - 1].color});
            }
          },
          build: () => {
            mockBuilds.push(build);
            return {
              layout: (w: number) => build.widths.push(w),
              getHeight: () => 30,
              dispose: () => undefined,
            };
          },
        };
      },
    },
  },
  TextAlign: {Center: 'center'},
  TextDirection: {RTL: 'rtl'},
  TextHeightBehavior: {DisableAll: 'disableAll'},
  PaintStyle: {Stroke: 'stroke'},
  StrokeCap: {Round: 'round'},
  StrokeJoin: {Round: 'round'},
}));
jest.mock('@/utils/skiaDeferredDispose', () => ({
  disposeAfterPendingDraws: () => undefined,
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {},
}));
jest.mock('@/services/mushaf/TajweedAlignmentService', () => ({
  // Rule of the first char of a word with QPC data; tafkhim on the second
  // char of one without.
  alignWordTajweed: () => new Map([[0, 'ghunnah']]),
  detectWordTafkhim: () => new Map([[1, 'tafkhim']]),
}));

import {
  headerCharColors,
  headerWordText,
  WordHeaderText,
  type WordHeaderTextProps,
} from '../WordHeaderText';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

// 2:181: the word-by-word بَعْدَ مَا is two DigitalKhatt slots.
const BADA = 'بَعْدَ';
const MA = 'مَا';
const SLOTS_2_181_3 = [
  {text: BADA, wordPositionInVerse: 3},
  {text: MA, wordPositionInVerse: 4},
];
const ALLAH = 'ٱللَّهُ';
const GOLD = '#A86A00';
const TAJWEED: IndexedTajweedData = {
  '2:181': [{word_index: 3, location: '2:181:3', segments: []}],
} as unknown as IndexedTajweedData;

let renderer: TestRenderer.ReactTestRenderer | null = null;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

beforeEach(() => {
  mockBuilds.length = 0;
});

describe('headerWordText and headerCharColors', () => {
  it('joins the slots of a word drawn as two', () => {
    expect(headerWordText(SLOTS_2_181_3)).toBe(`${BADA} ${MA}`);
  });

  it('colours each slot at its own offset in the joined text', () => {
    const colors = headerCharColors(SLOTS_2_181_3, TAJWEED['2:181'], GOLD);
    // Slot 3 has QPC data (aligned: its first char); slot 4 has none
    // (tafkhim: its second char), after the first slot and the space.
    expect([...colors]).toEqual([
      [0, tajweedColors.ghunnah],
      [BADA.length + 1 + 1, tajweedColors.tafkhim],
    ]);
  });

  it('gives a slot holding the Allah name the highlight colour, whole', () => {
    const colors = headerCharColors(
      [{text: ALLAH, wordPositionInVerse: 1}],
      [],
      GOLD,
    );
    expect(colors.size).toBe(ALLAH.length);
    expect(new Set(colors.values())).toEqual(new Set([GOLD]));
  });

  it('colours nothing with tajweed and the highlight off', () => {
    expect(
      headerCharColors([{text: ALLAH, wordPositionInVerse: 1}], null, undefined)
        .size,
    ).toBe(0);
  });
});

describe('WordHeaderText', () => {
  const props = (
    over: Partial<WordHeaderTextProps> = {},
  ): WordHeaderTextProps => ({
    verseKey: '2:181',
    slots: SLOTS_2_181_3,
    fontMgr: {fake: 'fontMgr'} as unknown as WordHeaderTextProps['fontMgr'],
    fontFamily: 'DigitalKhattIndoPak',
    rnFontFamily: 'DigitalKhattV2',
    fontSize: 36,
    color: '#111111',
    showTajweed: true,
    indexedTajweedData: TAJWEED,
    arabicTextWeight: 'normal',
    ...over,
  });

  function draw(p: WordHeaderTextProps, width = 300) {
    act(() => {
      renderer = TestRenderer.create(<WordHeaderText {...p} />);
    });
    if (!renderer) throw new Error('nothing rendered');
    const root = renderer.root;
    const box = root.findAll(n => (n.type as unknown) === View)[0];
    act(() => box.props.onLayout({nativeEvent: {layout: {width}}}));
    return {root, box};
  }

  it('is one heading, read in Arabic, labelled with the word', () => {
    const {box} = draw(props());
    expect(box.props).toMatchObject({
      accessible: true,
      accessibilityRole: 'header',
      accessibilityLabel: `${BADA} ${MA}`,
      accessibilityLanguage: 'ar',
    });
  });

  it('draws the word centred in the measured width, in the mushaf face', () => {
    draw(props());
    expect(mockBuilds).toHaveLength(1);
    const [build] = mockBuilds;
    expect(build.style).toMatchObject({textAlign: 'center'});
    expect(build.widths).toEqual([300]);
    expect(build.chars.map(c => c.char).join('')).toBe(`${BADA} ${MA}`);
    expect(build.chars[0].color).toBe(tajweedColors.ghunnah);
    expect(build.chars[1].color).toBe('#111111');
    expect(build.stroked).toBe(false);
  });

  it('draws no tajweed when it is off', () => {
    draw(props({showTajweed: false}));
    expect(new Set(mockBuilds[0].chars.map(c => c.color))).toEqual(
      new Set(['#111111']),
    );
  });

  it('adds a stroke paragraph for a heavier text weight', () => {
    draw(props({arabicTextWeight: 'bold'}));
    expect(mockBuilds.map(b => b.stroked)).toEqual([false, true]);
  });

  it('draws React Native Text in the DigitalKhatt face until the font manager is ready', () => {
    const {root} = draw(props({fontMgr: null}));
    expect(mockBuilds).toHaveLength(0);
    const [text] = root.findAll(n => (n.type as unknown) === Text);
    expect(text.props.children).toBe(`${BADA} ${MA}`);
    expect(text.props.style).toMatchObject({
      fontFamily: 'DigitalKhattV2',
      fontSize: 36,
      lineHeight: 72,
    });
  });
});
