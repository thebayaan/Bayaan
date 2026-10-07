// @ai-generated
/**
 * SkiaVerseText draws nothing until the verse's words are loaded. A caller
 * that passes renderPlaceholder (VerseItem in a non-Hafs context) gets it
 * rendered meanwhile, with the load status; other callers are unchanged.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text} from 'react-native';

const mockWords = {status: 'loading'};

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Paragraph: () => null,
  Group: () => null,
  RoundedRect: () => null,
  Skia: {},
  TextHeightBehavior: {DisableAll: 0},
  TextDirection: {RTL: 0},
}));

jest.mock('@/hooks/useRewayahWords', () => ({
  useRewayahWords: () => ({words: [], status: mockWords.status}),
}));

jest.mock('@/services/mushaf/AllahNameHighlightService', () => ({
  getTextAllahNameCharMap: () => null,
}));

jest.mock('../verseOverlays', () => ({
  computeVerseCharRuleMap: () => null,
  computeVerseDiffRanges: () => [],
}));

import SkiaVerseText from '../SkiaVerseText';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function renderText(
  renderPlaceholder?: (status: string) => React.ReactNode,
): string {
  let out: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    out = TestRenderer.create(
      <SkiaVerseText
        verseKey="2:1"
        rewayah="warsh"
        fontMgr={{} as SkTypefaceFontProvider}
        fontFamily="DigitalKhattV2"
        fontSize={24}
        textColor="#111111"
        showTajweed={false}
        width={320}
        indexedTajweedData={null}
        renderPlaceholder={renderPlaceholder}
      />,
    );
  });
  const json = JSON.stringify(out!.toJSON());
  act(() => out!.unmount());
  return json;
}

const placeholder = (status: string) => <Text>{`placeholder:${status}`}</Text>;

describe('SkiaVerseText placeholder', () => {
  it.each(['loading', 'error', 'unavailable'])(
    'renders the placeholder while the words are %s',
    status => {
      mockWords.status = status;
      expect(renderText(placeholder)).toContain(`placeholder:${status}`);
    },
  );

  it('renders nothing, as before, without a placeholder', () => {
    mockWords.status = 'loading';
    expect(renderText()).toBe('null');
  });
});
