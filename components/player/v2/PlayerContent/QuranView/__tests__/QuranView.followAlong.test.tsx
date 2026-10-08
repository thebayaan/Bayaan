// @ai-generated
/**
 * Player verse list (QuranView):
 *  - follow-along highlights every Hafs verse the reciter is reciting (Warsh
 *    2:1 = Hafs 2:1 + 2:2), not just the first; Hafs stays one verse;
 *  - a rewayah track's text is never drawn with a font that cannot draw it
 *    (IndoPak is Hafs only), mirroring the mushaf settings gating, while Hafs
 *    tracks and the Hafs word-by-word grid keep the reader's font.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface VerseItemProps {
  verse: {verse_key: string};
  isActive?: boolean;
  dkFontFamily: string;
  wbwFontFamily?: string;
  fontMgr: unknown;
  rewayah?: string;
}

const mockVerseItems: VerseItemProps[] = [];
const mockTrack = {rewayah: 'hafs'};
const mockHeaderFonts: string[] = [];
// @ai-start
const mockHeaderProps: {rewayah?: string; surahNumber?: number}[] = [];
// @ai-end

jest.mock('../VerseItem', () => ({
  VerseItem: (props: VerseItemProps) => {
    mockVerseItems.push(props);
    return null;
  },
}));

jest.mock('../BasmalaHeader', () => ({
  __esModule: true,
  default: (props: {
    dkFontFamily: string;
    rewayah?: string; // @ai
    surahNumber?: number; // @ai
  }) => {
    mockHeaderFonts.push(props.dkFontFamily);
    mockHeaderProps.push(props); // @ai
    return null;
  },
}));

jest.mock('../SurahDivider', () => ({
  __esModule: true,
  default: () => null,
  computeDividerTotalHeight: () => 0,
}));

jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual('react');
  const FlashList = ReactActual.forwardRef(
    (
      props: {
        data: unknown[];
        renderItem: (info: {item: unknown; index: number}) => unknown;
        ListHeaderComponent?: unknown;
      },
      ref: unknown,
    ) => {
      ReactActual.useImperativeHandle(ref, () => ({
        scrollToIndex: () => undefined,
        scrollToOffset: () => undefined,
      }));
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        props.ListHeaderComponent,
        props.data.map((item: unknown, index: number) =>
          ReactActual.createElement(
            ReactActual.Fragment,
            {key: index},
            props.renderItem({item, index}),
          ),
        ),
      );
    },
  );
  return {FlashList};
});

jest.mock('@gorhom/bottom-sheet', () => ({
  useBottomSheetScrollableCreator: () => undefined,
}));

jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', border: '#cccccc', card: '#ffffff'},
    },
    isDarkMode: false,
  }),
}));

jest.mock('@/hooks/useReadingThemeColors', () => ({
  useReadingThemeColors: () => ({
    text: '#111111',
    textSecondary: '#666666',
    background: '#ffffff',
  }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));

jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));

jest.mock('@/hooks/useCurrentTrackRewayah', () => ({
  useCurrentTrackRewayah: () => mockTrack.rewayah,
}));

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {initialized: true},
}));

jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      loadAnnotationsForSurah: () => undefined,
    })),
  };
});

jest.mock('@/store/tajweedStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useTajweedStore: create(() => ({indexedTajweedData: null}))};
});

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({queue: {tracks: [], currentIndex: 0}})),
  };
});

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));

jest.mock('@/utils/translationLookup', () => ({
  getTranslationName: () => 'Translation',
}));

jest.mock('@/config/branding', () => ({__esModule: true, default: {}}));

jest.mock('@/utils/enhancedVerseData', () => {
  const verses = Array.from({length: 8}, (_, i) => ({
    verse_key: `2:${i + 1}`,
    surah_number: 2,
    ayah_number: i + 1,
    text: '',
  }));
  return {
    enhancedVersesBySurah: {2: verses},
    rebuildEnhancedVerses: async () => false,
  };
});

import {QuranView} from '../index';
import {useTimestampStore} from '@/store/timestampStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render() {
  act(() => {
    renderer = TestRenderer.create(
      <QuranView
        currentSurah={2}
        onVersePress={() => undefined}
        transliterationFontSize={14}
        translationFontSize={14}
        arabicFontSize={24}
      />,
    );
  });
}

/** Props of the latest render of each verse row. */
function rows(): Map<string, VerseItemProps> {
  const latest = new Map<string, VerseItemProps>();
  for (const p of mockVerseItems) latest.set(p.verse.verse_key, p);
  return latest;
}

const active = () =>
  [...rows().values()].filter(p => p.isActive).map(p => p.verse.verse_key);

function track(state: object | null) {
  act(() => {
    useTimestampStore.setState({
      currentAyah: state as never,
      isLocked: true,
    });
  });
}

beforeEach(() => {
  mockVerseItems.length = 0;
  mockHeaderFonts.length = 0;
  mockHeaderProps.length = 0; // @ai
  mockTrack.rewayah = 'hafs';
  useMushafSettingsStore.setState({
    mushafRenderer: 'dk_v2',
    rewayah: 'hafs',
  });
  useTimestampStore.setState({currentAyah: null, isLocked: true});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('player verse list follow-along', () => {
  it('highlights every Hafs verse of a reciter verse (Warsh 2:1 = Hafs 2:1 + 2:2)', () => {
    mockTrack.rewayah = 'warsh';
    render();
    track({
      surahNumber: 2,
      ayahNumber: 1,
      verseKey: '2:1',
      timestampFrom: 0,
      timestampTo: 1000,
      verseKeys: ['2:1', '2:2'],
      reciterVerseKey: '2:1',
    });
    expect(active()).toEqual(['2:1', '2:2']);
    track({
      surahNumber: 2,
      ayahNumber: 3,
      verseKey: '2:3',
      timestampFrom: 1000,
      timestampTo: 2000,
      verseKeys: ['2:3'],
      reciterVerseKey: '2:2',
    });
    expect(active()).toEqual(['2:3']);
  });

  it('Hafs: one highlighted verse, the tracked one', () => {
    render();
    track({
      surahNumber: 2,
      ayahNumber: 5,
      verseKey: '2:5',
      timestampFrom: 0,
      timestampTo: 1000,
      verseKeys: ['2:5'],
      reciterVerseKey: '2:5',
    });
    expect(active()).toEqual(['2:5']);
    // a state written without verseKeys (older writers) still highlights it
    track({
      surahNumber: 2,
      ayahNumber: 6,
      verseKey: '2:6',
      timestampFrom: 0,
      timestampTo: 1000,
    });
    expect(active()).toEqual(['2:6']);
    track(null);
    expect(active()).toEqual([]);
  });

  it('nothing is highlighted while the list is unlocked (scrolled away)', () => {
    render();
    act(() => {
      useTimestampStore.setState({
        currentAyah: {
          surahNumber: 2,
          ayahNumber: 1,
          verseKey: '2:1',
          timestampFrom: 0,
          timestampTo: 1,
          verseKeys: ['2:1', '2:2'],
        } as never,
        isLocked: false,
      });
    });
    expect(active()).toEqual([]);
  });
});

describe('player text font', () => {
  it('IndoPak + a rewayah track: the text is drawn with DigitalKhatt', () => {
    useMushafSettingsStore.setState({mushafRenderer: 'dk_indopak'});
    mockTrack.rewayah = 'warsh';
    render();
    const row = rows().get('2:1')!;
    expect(row.dkFontFamily).toBe('DigitalKhattV2');
    expect(row.fontMgr).toBeTruthy();
    expect(row.rewayah).toBe('warsh');
    // the word-by-word grid shows Hafs words: the reader's font
    expect(row.wbwFontFamily).toBe('DigitalKhattIndoPak');
    // the basmala above the rewayah's verses matches them
    expect(mockHeaderFonts[mockHeaderFonts.length - 1]).toBe('DigitalKhattV2');
    // @ai-start
    // ...and is that rewayah's own basmala for the surah (contract C6)
    expect(mockHeaderProps[mockHeaderProps.length - 1]).toMatchObject({
      rewayah: 'warsh',
      surahNumber: 2,
    });
    // @ai-end
  });

  it.each([
    ['dk_indopak', 'DigitalKhattIndoPak'],
    ['dk_v1', 'DigitalKhattV1'],
    ['dk_v2', 'DigitalKhattV2'],
  ] as const)('Hafs track under %s keeps %s', (renderer_, font) => {
    useMushafSettingsStore.setState({mushafRenderer: renderer_});
    render();
    const row = rows().get('2:1')!;
    expect(row.dkFontFamily).toBe(font);
    expect(row.wbwFontFamily).toBe(font);
    expect(mockHeaderFonts[mockHeaderFonts.length - 1]).toBe(font);
  });

  it('Mushaf 1440 (QCF): a rewayah track is drawn with DigitalKhatt, a Hafs track keeps QCF text', () => {
    useMushafSettingsStore.setState({mushafRenderer: 'qcf_v2'});
    mockTrack.rewayah = 'qalun';
    render();
    expect(rows().get('2:1')!.dkFontFamily).toBe('DigitalKhattV2');
    expect(rows().get('2:1')!.fontMgr).toBeTruthy();
    act(() => renderer?.unmount());
    mockVerseItems.length = 0;
    mockTrack.rewayah = 'hafs';
    render();
    // no DigitalKhatt font manager: VerseItem shows the QPC (Hafs) text
    expect(rows().get('2:1')!.fontMgr).toBeNull();
  });
});
