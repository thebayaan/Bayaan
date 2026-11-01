// @ai-generated
/**
 * RFC-023 step 5: the vertical Mushaf reports its first content once. An item
 * draws nothing while there is no font manager, and the reader can open before
 * the fonts load. So the report needs both the list's first draw and the fonts.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {MushafLayoutMetrics} from '../../constants';

interface MockFlashListProps {
  onLoad?: (info: {elapsedTimeInMs: number}) => void;
}

const mockState = {
  flashList: null as MockFlashListProps | null,
  fontMgr: null as object | null,
  fontListeners: new Set<() => void>(),
};

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Skia: {},
}));
jest.mock('react-native-gesture-handler', () => ({
  Gesture: {},
  GestureDetector: () => null,
}));
jest.mock('react-native-worklets', () => ({runOnJS: (fn: unknown) => fn}));
// Draws nothing: the test raises onLoad, as FlashList does after its first draw.
jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual('react');
  const FlashList = ReactActual.forwardRef(
    (props: MockFlashListProps, _ref: unknown) => {
      mockState.flashList = props;
      return null;
    },
  );
  return {FlashList};
});
// Subscribes as the real hook does, so the end of the preload renders the view.
jest.mock('@/hooks/useMushafFontMgr', () => {
  const ReactActual = jest.requireActual('react');
  const subscribe = (listener: () => void) => {
    mockState.fontListeners.add(listener);
    return () => {
      mockState.fontListeners.delete(listener);
    };
  };
  return {
    useMushafFontMgr: () =>
      ReactActual.useSyncExternalStore(subscribe, () => mockState.fontMgr),
  };
});
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {quranCommonTypeface: null},
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: true,
    rewayah: 'hafs',
    subscribeCacheChanges: () => () => undefined,
    getLayoutIdentityKey: () => 'hafs@test',
    getSurahStartPages: () => ({}),
    getPageToSurah: () => ({}),
  },
  getRewayahFontFamily: () => 'DigitalKhattV2',
}));
jest.mock('@/services/mushaf/JustificationService', () => ({JustService: {}}));
jest.mock('@/services/mushaf/MushafLayoutCacheService', () => ({
  mushafLayoutCacheService: {},
}));
jest.mock('@/services/mushaf/QuranTextService', () => ({
  quranTextService: {},
  PAGE_WIDTH: 400,
  MARGIN: 10,
  FONTSIZE: 20,
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
jest.mock('../SkiaLine', () => ({__esModule: true, default: () => null}));
jest.mock('../SkiaSurahHeader', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../pageOverlays', () => ({
  getPageTextIdentity: () => 'hafs@test',
}));
jest.mock('../verseHighlightLayers', () => ({}));
jest.mock('../playbackBand', () => ({usePlaybackBand: () => null}));
jest.mock('../verseUnitDragSelect', () => ({}));
jest.mock('@/store/mushafPlayerStore', () => ({
  usePlaybackBasmalaSurah: () => null,
}));
jest.mock('@/store/mushafVerseSelectionStore', () => ({
  useMushafVerseSelectionStore: () => undefined,
}));
jest.mock('@/store/verseAnnotationsStore', () => ({
  useVerseAnnotationsStore: () => () => undefined,
}));
jest.mock('@/store/tajweedStore', () => ({
  useTajweedStore: () => null,
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import ContinuousMushafView from '../ContinuousMushafView';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const METRICS = {
  screenWidth: 400,
  pageWidth: 400,
  contentWidth: 380,
  pageOffsetX: 0,
  baseLineHeight: 40,
} as MushafLayoutMetrics;

let renderer: TestRenderer.ReactTestRenderer | null = null;
const onFirstContent = jest.fn();

function view(textColor = '#111111'): React.JSX.Element {
  return (
    <ContinuousMushafView
      textColor={textColor}
      dividerColor="#666666"
      initialPage={3}
      metrics={METRICS}
      onFirstContent={onFirstContent}
    />
  );
}

function render(): void {
  act(() => {
    renderer = TestRenderer.create(view());
  });
}

function raiseListLoad(): void {
  act(() => mockState.flashList?.onLoad?.({elapsedTimeInMs: 1}));
}

beforeEach(() => {
  onFirstContent.mockClear();
  mockState.flashList = null;
  mockState.fontMgr = {fake: 'fontMgr'};
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('reports once, when the list has drawn its first pages', () => {
  render();
  expect(onFirstContent).not.toHaveBeenCalled();

  raiseListLoad();
  expect(onFirstContent).toHaveBeenCalledTimes(1);

  raiseListLoad();
  act(() => renderer?.update(view('#222222')));
  expect(onFirstContent).toHaveBeenCalledTimes(1);
});

it('waits for the fonts: an item is empty without them', () => {
  mockState.fontMgr = null;
  render();
  raiseListLoad();
  expect(onFirstContent).not.toHaveBeenCalled();

  act(() => {
    mockState.fontMgr = {fake: 'fontMgr'};
    for (const listener of mockState.fontListeners) listener();
  });
  expect(onFirstContent).toHaveBeenCalledTimes(1);
});
