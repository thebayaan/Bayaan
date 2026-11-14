// @ai-generated
/**
 * ReadingText draws a reading in the DigitalKhatt font of its rewayah, as
 * the mushaf does (getDkFontFamily), with the silah chars in the silah
 * colour; without the mushaf font manager it draws nothing (never a UI-font
 * fallback). Skia is replaced by a recording paragraph builder; the texts are
 * placeholders, not Quran text.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text, View} from 'react-native';
import {tajweedColors} from '@/constants/tajweedColors';
import type {MushafRenderer} from '@/store/mushafSettingsStore';

interface MockStyle {
  color: string;
  fontFamilies: string[];
  fontSize: number;
}
const mockBuilds: {
  chars: {char: string; style: MockStyle}[];
  widths: number[];
}[] = [];
const mockFont: {mgr: unknown; longestLine: number} = {
  mgr: {fake: 'fontMgr'},
  longestLine: 40,
};

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Paragraph: () => null,
  Skia: {
    Color: (c: string) => c,
    ParagraphBuilder: {
      Make: () => {
        const stack: MockStyle[] = [];
        const build = {
          chars: [] as {char: string; style: MockStyle}[],
          widths: [] as number[],
        };
        return {
          pushStyle: (style: MockStyle) => stack.push(style),
          pop: () => stack.pop(),
          addText: (text: string) => {
            for (const char of text) {
              build.chars.push({char, style: stack[stack.length - 1]});
            }
          },
          build: () => {
            mockBuilds.push(build);
            return {
              layout: (w: number) => build.widths.push(w),
              getLongestLine: () => mockFont.longestLine,
              getHeight: () => 30,
              dispose: () => undefined,
            };
          },
        };
      },
    },
  },
  TextHeightBehavior: {DisableAll: 0},
  TextDirection: {RTL: 0},
}));

jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => mockFont.mgr,
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {text: '#111111'}}}),
}));

jest.mock('@/utils/skiaDeferredDispose', () => ({
  disposeAfterPendingDraws: () => undefined,
}));

import ReadingText from '../ReadingText';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function draw(
  element: Parameters<typeof TestRenderer.create>[0],
): TestRenderer.ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(element);
  });
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

function setRenderer(mushafRenderer: MushafRenderer) {
  act(() => useMushafSettingsStore.setState({mushafRenderer}));
}

beforeEach(() => {
  mockBuilds.length = 0;
  mockFont.mgr = {fake: 'fontMgr'};
  mockFont.longestLine = 40;
  setRenderer('dk_v2');
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('draws in the font the mushaf uses for the rewayah', () => {
  const family = (rewayah: 'hafs' | 'warsh') => {
    mockBuilds.length = 0;
    draw(
      <ReadingText
        text="READING"
        rewayah={rewayah}
        fontSize={24}
        maxWidth={300}
      />,
    );
    act(() => renderer?.unmount());
    return mockBuilds[0].chars[0].style.fontFamilies;
  };
  expect(family('warsh')).toEqual(['DigitalKhattV2']);
  setRenderer('dk_indopak');
  expect(family('hafs')).toEqual(['DigitalKhattIndoPak']);
  expect(family('warsh')).toEqual(['DigitalKhattV2']); // IndoPak draws Hafs only
  setRenderer('dk_v1');
  expect(family('warsh')).toEqual(['DigitalKhattV1']);
  setRenderer('qcf_v2');
  expect(family('hafs')).toEqual(['DigitalKhattV2']);
});

it('colours exactly the silah chars', () => {
  draw(
    <ReadingText
      text="ABCDE"
      rewayah="al-bazzi"
      fontSize={24}
      silahChars={[3, 4]}
      maxWidth={300}
    />,
  );
  const colours = mockBuilds[0].chars.map(c => c.style.color);
  expect(mockBuilds[0].chars.map(c => c.char).join('')).toBe('ABCDE');
  expect(colours).toEqual([
    '#111111',
    '#111111',
    '#111111',
    tajweedColors.silah,
    tajweedColors.silah,
  ]);
  expect(mockBuilds[0].chars.every(c => c.style.fontSize === 24)).toBe(true);
});

it('draws at its own width, at most maxWidth', () => {
  const root = draw(
    <ReadingText text="SHORT" rewayah="hafs" fontSize={24} maxWidth={300} />,
  );
  expect(mockBuilds[0].widths).toEqual([300, 41]);
  expect(
    root.findAll(n => (n.type as unknown) === View)[0].props.style,
  ).toMatchObject({width: 41});

  act(() => renderer?.unmount());
  mockBuilds.length = 0;
  mockFont.longestLine = 900;
  const wide = draw(
    <ReadingText text="LONG" rewayah="hafs" fontSize={24} maxWidth={300} />,
  );
  expect(mockBuilds[0].widths).toEqual([300, 300]);
  expect(
    wide.findAll(n => (n.type as unknown) === View)[0].props.style,
  ).toMatchObject({width: 300});
});

it('draws nothing, and no UI-font text, until the mushaf font manager is ready', () => {
  mockFont.mgr = null;
  const root = draw(
    <ReadingText text="READING" rewayah="warsh" fontSize={24} maxWidth={300} />,
  );
  expect(mockBuilds).toEqual([]);
  expect(root.findAll(n => (n.type as unknown) === Text)).toEqual([]);
  const box = root.findAll(n => (n.type as unknown) === View)[0];
  expect(box.props.style).toEqual({minHeight: 48});
  expect(box.props.accessibilityLabel).toBe('READING');
});

it('is labelled with its text, or the label given', () => {
  const root = draw(
    <ReadingText text="READING" rewayah="hafs" fontSize={24} maxWidth={300} />,
  );
  const view = root.findAll(n => (n.type as unknown) === View)[0];
  expect(view.props.accessibilityLabel).toBe('READING');
  expect(view.props.accessible).toBe(true);
  expect(root.findAll(n => (n.type as unknown) === Text)).toEqual([]);

  act(() => renderer?.unmount());
  const labelled = draw(
    <ReadingText
      text="READING"
      rewayah="hafs"
      fontSize={24}
      maxWidth={300}
      accessibilityLabel="LABEL"
    />,
  );
  expect(
    labelled.findAll(n => (n.type as unknown) === View)[0].props
      .accessibilityLabel,
  ).toBe('LABEL');
});
