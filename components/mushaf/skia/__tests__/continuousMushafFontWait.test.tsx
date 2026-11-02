// @ai-generated
/**
 * An item of the continuous view has no height until the fonts are there, and
 * the fonts finish after the data. So the view mounts no list until then: a
 * list mounted earlier mounts all 604 pages to fill the screen, and draws all
 * of them when the fonts arrive.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface MockListProps {
  data: number[];
  initialScrollIndex: number;
}

// Shared with the mock factories below (read lazily, after module init).
const mockFonts = {
  current: null as object | null,
  listeners: new Set<() => void>(),
};
const mockList = {mounts: [] as MockListProps[]};

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Skia: {},
}));

jest.mock('@/hooks/useMushafFontMgr', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useMushafFontMgr: () =>
      ReactActual.useSyncExternalStore(
        (listener: () => void) => {
          mockFonts.listeners.add(listener);
          return () => {
            mockFonts.listeners.delete(listener);
          };
        },
        () => mockFonts.current,
      ),
  };
});

jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const FlashList = (props: MockListProps) => {
    ReactActual.useEffect(() => {
      mockList.mounts.push(props);
      // Mount only: the props of this first render are the ones to check.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  };
  return {FlashList};
});

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    rewayah: 'hafs',
    initialized: true,
    getCacheVersion: () => 0,
    subscribeCacheChanges: () => () => undefined,
    getLayoutIdentityKey: () => 'hafs@test',
    getSurahStartPages: () => ({}),
    getPageToSurah: () => ({}),
  },
  getRewayahFontFamily: () => 'DigitalKhattV2',
}));

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {quranCommonTypeface: null},
}));
jest.mock('@/services/mushaf/JustificationService', () => ({JustService: {}}));
jest.mock('@/services/mushaf/MushafLayoutCacheService', () => ({
  mushafLayoutCacheService: {},
}));
jest.mock('@/services/mushaf/QuranTextService', () => ({
  quranTextService: {},
  PAGE_WIDTH: 1000,
  MARGIN: 10,
  FONTSIZE: 100,
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {},
}));
jest.mock('@/services/mushaf/RewayahVerseUnits', () => ({
  parseAnchorKey: () => null,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {},
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  usePlaybackBasmalaSurah: () => null,
}));
jest.mock('@/store/verseAnnotationsStore', () => ({
  useVerseAnnotationsStore: () => undefined,
}));
jest.mock('@/store/mushafVerseSelectionStore', () => ({
  useMushafVerseSelectionStore: () => undefined,
}));
jest.mock('@/store/tajweedStore', () => ({
  useTajweedStore: () => null,
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: (selector: (s: object) => unknown) =>
    selector({rewayah: 'hafs', mushafRenderer: 'dk_v2'}),
}));
jest.mock('react-native-gesture-handler', () => ({
  Gesture: {},
  GestureDetector: () => null,
}));
jest.mock('react-native-worklets', () => ({runOnJS: (fn: unknown) => fn}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('../SkiaLine', () => ({__esModule: true, default: () => null}));
jest.mock('../SkiaSurahHeader', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../pageOverlays', () => ({getPageTextIdentity: () => 'hafs@test'}));
jest.mock('../verseHighlightLayers', () => ({}));
jest.mock('../playbackBand', () => ({usePlaybackBand: () => null}));
jest.mock('../verseUnitDragSelect', () => ({}));

import ContinuousMushafView from '../ContinuousMushafView';
import {getMushafLayout} from '../../constants';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function fontsArrive(): void {
  act(() => {
    mockFonts.current = {};
    for (const listener of [...mockFonts.listeners]) listener();
  });
}

describe('ContinuousMushafView while the fonts load', () => {
  let renderer: TestRenderer.ReactTestRenderer;

  beforeEach(() => {
    mockFonts.current = null;
    mockList.mounts = [];
    act(() => {
      renderer = TestRenderer.create(
        <ContinuousMushafView
          textColor="#111111"
          dividerColor="#666666"
          initialPage={68}
          metrics={getMushafLayout({width: 390, height: 844, isTablet: false})}
        />,
      );
    });
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('mounts no list until the fonts are there', () => {
    expect(mockList.mounts).toHaveLength(0);
  });

  it('then mounts one list at the saved page', () => {
    fontsArrive();
    expect(mockList.mounts).toHaveLength(1);
    expect(mockList.mounts[0].initialScrollIndex).toBe(67);
  });
});
