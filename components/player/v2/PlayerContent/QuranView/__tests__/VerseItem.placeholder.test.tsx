// @ai-generated
/**
 * VerseItem never shows Hafs text in a non-Hafs context (a rewayah track in
 * the player, a rewayah mushaf's verse list), not even on the first frame
 * before the row is measured: a neutral placeholder holds the place until
 * DigitalKhatt draws the rewayah's own text. Hafs contexts are unchanged.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface SkiaProps {
  verseKey: string;
  rewayah?: string;
  fontFamily: string;
  renderPlaceholder?: (status: string) => React.ReactNode;
}

const mockSkiaRenders: SkiaProps[] = [];
const mockWbwFonts: string[] = [];

jest.mock('../SkiaVerseText', () => ({
  __esModule: true,
  default: (props: SkiaProps) => {
    mockSkiaRenders.push(props);
    return null;
  },
}));

jest.mock('../WBWVerseView', () => ({
  WBWVerseView: (props: {dkFontFamily: string}) => {
    mockWbwFonts.push(props.dkFontFamily);
    return null;
  },
}));

jest.mock('@/components/mushaf/AyahCommunityReflections', () => ({
  AyahCommunityReflections: () => null,
}));

jest.mock('@/components/utils/FormattedText', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn(() => Promise.resolve())},
}));

jest.mock('@/utils/haptics', () => ({mediumHaptics: jest.fn()}));

jest.mock('@/utils/translationLookup', () => ({
  isBundledTranslation: () => true,
  getBundledFootnotes: () => undefined,
}));

jest.mock('@/store/tajweedStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useTajweedStore: create(() => ({
      indexedTajweedData: {
        '2:1': [
          {
            word_index: 0,
            location: '2:1:1',
            segments: [{text: 'QPC-HAFS-WORD', rule: null}],
          },
        ],
      },
    })),
  };
});

jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      bookmarkedVerseKeys: new Set(),
      notedVerseKeys: new Set(),
    })),
  };
});

jest.mock('@/store/verseSelectionStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseSelectionStore: create(() => ({
      selectedVerseKey: null,
      selectVerse: () => undefined,
    })),
  };
});

import {VerseItem} from '../VerseItem';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const FONT_MGR = {fake: 'fontMgr'} as unknown as SkTypefaceFontProvider;
const VERSE = {
  verse_key: '2:1',
  surah_number: 2,
  ayah_number: 1,
  text: 'BUNDLED-HAFS-TEXT',
} as never;

let renderer: TestRenderer.ReactTestRenderer | null = null;
/** Serialized output of every commit, to catch a Hafs flash on any frame. */
let frames: string[] = [];

function render(props: {
  rewayah?: 'hafs' | 'warsh';
  fontMgr?: SkTypefaceFontProvider | null;
  showWBW?: boolean;
  wbwFontFamily?: string;
}) {
  act(() => {
    renderer = TestRenderer.create(
      <VerseItem
        verse={VERSE}
        onVersePress={() => undefined}
        textColor="#111111"
        borderColor="#cccccc"
        showTajweed={false}
        arabicFontFamily="Uthmani"
        transliterationFontSize={14}
        translationFontSize={14}
        arabicFontSize={24}
        fontMgr={props.fontMgr ?? null}
        dkFontFamily="DigitalKhattV2"
        wbwFontFamily={props.wbwFontFamily}
        indexedTajweedData={null}
        rewayah={props.rewayah}
        showWBW={props.showWBW}
      />,
    );
  });
  frames.push(JSON.stringify(renderer!.toJSON()));
}

/** Fire the Arabic container's onLayout (the row gets measured). */
function measure(width: number) {
  const target = renderer!.root.findAll(
    n => typeof n.type === 'string' && typeof n.props.onLayout === 'function',
  )[0];
  act(() => {
    target.props.onLayout({nativeEvent: {layout: {width}}});
  });
  frames.push(JSON.stringify(renderer!.toJSON()));
}

const hasHafsText = (frame: string) =>
  frame.includes('QPC-HAFS-WORD') || frame.includes('BUNDLED-HAFS-TEXT');
const hasNotice = (frame: string) => frame.includes('Shown in Hafs');
const hasPlaceholder = (frame: string) =>
  frame.includes('verse-text-placeholder');

beforeEach(() => {
  mockSkiaRenders.length = 0;
  mockWbwFonts.length = 0;
  frames = [];
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('non-Hafs context: never Hafs text, not even for a frame', () => {
  it('rewayah track, first frame before measuring, then DigitalKhatt', () => {
    render({rewayah: 'warsh', fontMgr: FONT_MGR});
    expect(hasPlaceholder(frames[0])).toBe(true);
    expect(mockSkiaRenders).toHaveLength(0);
    measure(320);
    const skia = mockSkiaRenders[mockSkiaRenders.length - 1];
    expect(skia).toMatchObject({verseKey: '2:1', rewayah: 'warsh'});
    // while the rewayah's words load, SkiaVerseText shows the placeholder
    expect(typeof skia.renderPlaceholder).toBe('function');
    for (const frame of frames) {
      expect(hasHafsText(frame)).toBe(false);
      expect(hasNotice(frame)).toBe(false);
    }
  });

  it('fonts not ready yet: a placeholder, not the Hafs text', () => {
    render({rewayah: 'warsh', fontMgr: null});
    measure(320);
    for (const frame of frames) {
      expect(hasHafsText(frame)).toBe(false);
      expect(hasNotice(frame)).toBe(false);
      expect(hasPlaceholder(frame)).toBe(true);
    }
    expect(mockSkiaRenders).toHaveLength(0);
  });

  it('a rewayah mushaf verse list (no rewayah prop) behaves the same', () => {
    useMushafSettingsStore.setState({rewayah: 'warsh'});
    render({fontMgr: FONT_MGR});
    measure(320);
    for (const frame of frames) expect(hasHafsText(frame)).toBe(false);
    expect(frames.some(hasPlaceholder)).toBe(true);
  });

  it('words that fail to load say so (still no Hafs text)', () => {
    render({rewayah: 'warsh', fontMgr: FONT_MGR});
    measure(320);
    const skia = mockSkiaRenders[mockSkiaRenders.length - 1];
    const show = (status: string) => {
      let out: TestRenderer.ReactTestRenderer | null = null;
      act(() => {
        out = TestRenderer.create(<>{skia.renderPlaceholder!(status)}</>);
      });
      const json = JSON.stringify(out!.toJSON());
      act(() => out!.unmount());
      return json;
    };
    const failed = show('error');
    expect(failed).toContain("Verse text couldn't be loaded.");
    expect(hasHafsText(failed)).toBe(false);
    expect(hasPlaceholder(show('loading'))).toBe(true);
  });
});

describe('Hafs context: unchanged', () => {
  it('QPC Hafs text until DigitalKhatt can draw, no placeholder', () => {
    render({rewayah: 'hafs', fontMgr: FONT_MGR});
    expect(hasHafsText(frames[0])).toBe(true);
    expect(hasPlaceholder(frames[0])).toBe(false);
    measure(320);
    const skia = mockSkiaRenders[mockSkiaRenders.length - 1];
    expect(skia.rewayah).toBe('hafs');
    expect(skia.renderPlaceholder).toBeUndefined();
  });

  it('without DigitalKhatt (QCF renderer) the QPC Hafs text stays', () => {
    render({fontMgr: null});
    measure(320);
    for (const frame of frames) {
      expect(hasHafsText(frame)).toBe(true);
      expect(hasNotice(frame)).toBe(false);
    }
    expect(mockSkiaRenders).toHaveLength(0);
  });
});

describe('word-by-word grid font', () => {
  it('uses wbwFontFamily when given, else the text font', () => {
    render({
      rewayah: 'warsh',
      fontMgr: FONT_MGR,
      showWBW: true,
      wbwFontFamily: 'DigitalKhattIndoPak',
    });
    expect(mockWbwFonts[mockWbwFonts.length - 1]).toBe('DigitalKhattIndoPak');
    act(() => renderer?.unmount());
    render({fontMgr: FONT_MGR, showWBW: true});
    expect(mockWbwFonts[mockWbwFonts.length - 1]).toBe('DigitalKhattV2');
  });
});
