/**
 * WBWVerseView word selection: by default (the player) a tap is the row's
 * own tap and a long press selects a word; with `selectOnTap` (the i'rab
 * view) a single tap selects the word. Fallback layout (no font manager).
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Paragraph: () => null,
  Skia: {},
  TextHeightBehavior: {DisableAll: 0},
  TextDirection: {RTL: 0},
}));

// Hafs 1:7 as placeholder words: 9 words and the end marker (slot 10).
jest.mock('@/hooks/useRewayahWords', () => {
  const words = Array.from({length: 10}, (_, i) => ({
    text: i === 9 ? '۝٧' : `h${i + 1}`,
    verseKey: '1:7',
    wordPositionInVerse: i + 1,
  }));
  return {useRewayahWords: () => ({words, status: 'ready'})};
});

jest.mock('@/services/wbw/WBWDataService', () => ({
  wbwDataService: {
    getVerseWordsCached: () =>
      Array.from({length: 9}, (_, i) => ({
        position: i + 1,
        textUthmani: `h${i + 1}`,
        translation: `t${i + 1}`,
        transliteration: `tl${i + 1}`,
        audioUrl: '',
      })),
    getVerseWords: async () => [],
  },
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', textSecondary: '#666666'},
    },
  }),
}));

jest.mock('@/utils/haptics', () => ({mediumHaptics: jest.fn()}));

jest.mock('@/services/mushaf/TajweedAlignmentService', () => ({
  alignWordTajweed: () => [],
  detectWordTafkhim: () => [],
}));

jest.mock('@/services/mushaf/AllahNameHighlightService', () => ({
  wordContainsAllahName: () => false,
}));

jest.mock('@/utils/skiaTextWeight', () => ({
  createTextStrokePaint: () => undefined,
  getArabicTextWeightStrokeWidth: () => 0,
}));

import {WBWVerseView} from '../WBWVerseView';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function render(selectOnTap: boolean) {
  const onWordPress = jest.fn();
  const onTap = jest.fn();
  let out: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    out = TestRenderer.create(
      <WBWVerseView
        verseKey="1:7"
        textColor="#111111"
        arabicFontSize={24}
        dkFontFamily="DigitalKhattV2"
        fontMgr={null}
        showTranslation={false}
        showTransliteration={false}
        onWordPress={onWordPress}
        selectedWordPosition={null}
        showTajweed={false}
        indexedTajweedData={null}
        rewayah="hafs"
        onTap={onTap}
        selectOnTap={selectOnTap}
      />,
    );
  });
  // One pressable unit per word (composite nodes only, not their host views).
  const words = out!.root.findAll(
    n =>
      typeof n.type !== 'string' &&
      ('onPress' in n.props || 'onLongPress' in n.props) &&
      n.parent !== null &&
      !('onPress' in (n.parent.props ?? {})),
  );
  return {words, onWordPress, onTap, unmount: () => act(() => out!.unmount())};
}

describe('WBWVerseView word selection', () => {
  it('selectOnTap: one tap selects the word, the row tap is not called', () => {
    const {words, onWordPress, onTap, unmount} = render(true);
    expect(words).toHaveLength(9);
    act(() => words[2].props.onPress());
    expect(onWordPress).toHaveBeenCalledWith(3);
    expect(onTap).not.toHaveBeenCalled();
    expect(words[2].props.onLongPress).toBeUndefined();
    unmount();
  });

  it('default (player): tap is the row tap, long press selects', () => {
    const {words, onWordPress, onTap, unmount} = render(false);
    act(() => words[4].props.onPress());
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onWordPress).not.toHaveBeenCalled();
    act(() => words[4].props.onLongPress());
    expect(onWordPress).toHaveBeenCalledWith(5);
    unmount();
  });
});
