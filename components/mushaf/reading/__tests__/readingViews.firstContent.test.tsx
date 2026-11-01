// @ai-generated
/**
 * RFC-023 step 5: the reading views (ReadingPageView, ContinuousListView) report
 * their first content once. That content is their rows, or the message of a
 * rewayah whose verse units failed. A spinner is no content.
 *
 * Without a report from the horizontal ReadingPageView, a restore in the list
 * mode waits for the whole deadline.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface MockFlashListProps {
  data: unknown[];
  onLoad?: (info: {elapsedTimeInMs: number}) => void;
}

const mockRecorded = {flashList: null as MockFlashListProps | null};
// The units the runtime service builds from the words in memory.
const mockUnits = {
  byRewayah: new Map<string, unknown>(),
  // Status of a rewayah without units here.
  status: 'loading',
};

jest.mock('@/components/player/v2/PlayerContent/QuranView/VerseItem', () => ({
  VerseItem: () => null,
}));
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/BasmalaHeader',
  () => ({__esModule: true, default: () => null}),
);
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SurahDivider',
  () => ({__esModule: true, default: () => null}),
);
jest.mock('@/components/mushaf/PageEdgeDecoration', () => ({
  __esModule: true,
  default: () => null,
  EDGE_BORDER_RADIUS: 40,
  EDGE_HORIZONTAL_INSET: 4,
}));
// Draws nothing: the test raises onLoad, as FlashList does after its first draw.
jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual('react');
  const FlashList = ReactActual.forwardRef(
    (props: MockFlashListProps, _ref: unknown) => {
      mockRecorded.flashList = props;
      return null;
    },
  );
  return {FlashList};
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const actual = jest.requireActual(
    '@/services/mushaf/DigitalKhattDataService',
  );
  const {createFakeDKService} = jest.requireActual(
    '@/services/mushaf/__fixtures__/rewayahOverlayFixture',
  );
  const service = createFakeDKService(actual.BASMALLAH_TEXT);
  return {
    ...actual,
    digitalKhattDataService: Object.assign(service, {
      getRewayahLoadState: () => 'loaded',
      ensureRewayahLoaded: async () => undefined,
      retainRewayah: () => () => undefined,
    }),
  };
});
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({
      peek: (rewayah: string) => mockUnits.byRewayah.get(rewayah) ?? null,
      status: () => mockUnits.status,
    }),
}));
jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {getThemeForVerse: () => undefined},
}));
jest.mock('@/utils/translationLookup', () => ({
  ...jest.requireActual('@/utils/translationLookup'),
  getTranslationName: () => 'Translation',
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
// mushafPlayerStore's playback dependencies (not exercised here)
jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

import ContinuousListView from '../ContinuousListView';
import ReadingPageView from '../ReadingPageView';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {FakeDKService} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';
import type {VerseUnitsServiceStub} from '@/services/mushaf/__fixtures__/verseUnitsServiceStub';
import {
  buildFixtureUnits,
  fixtureLines,
  fixtureWords,
  UNITS_FIXTURE_REWAYAH,
  type UnitsFixtureDb,
} from '@/services/mushaf/__fixtures__/verseUnitPages';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const dk = digitalKhattDataService as unknown as FakeDKService;
const unitsService =
  rewayahVerseUnitsService as unknown as VerseUnitsServiceStub;

let renderer: TestRenderer.ReactTestRenderer | null = null;
const onFirstContent = jest.fn();

/** Shows `db` in the mushaf, with no verse units yet. */
function show(db: UnitsFixtureDb): void {
  const rewayah = UNITS_FIXTURE_REWAYAH[db];
  mockUnits.byRewayah.clear();
  dk.loadData({rewayah, words: fixtureWords(db), lines: fixtureLines()});
  useMushafSettingsStore.setState({rewayah, mushafRenderer: 'dk_v2'});
}

/** A build of the verse units ends. */
function buildUnits(db: UnitsFixtureDb): void {
  mockUnits.byRewayah.set(UNITS_FIXTURE_REWAYAH[db], buildFixtureUnits(db));
  act(() => unitsService.notify());
}

function raiseListLoad(): void {
  act(() => mockRecorded.flashList?.onLoad?.({elapsedTimeInMs: 1}));
}

// `textColor` changes in a later update: React.memo skips one with equal props.
function readingPage(textColor = '#111111'): React.JSX.Element {
  return (
    <ReadingPageView
      pageNumber={1}
      textColor={textColor}
      surahLabel=""
      juzLabel=""
      pageLabel=""
      labelColor="#666666"
      borderColor="#cccccc"
      cardColor="#ffffff"
      bgColor="#ffffff"
      isBookLayout={false}
      onFirstContent={onFirstContent}
    />
  );
}

function continuousList(textColor = '#111111'): React.JSX.Element {
  return (
    <ContinuousListView
      textColor={textColor}
      labelColor="#666666"
      borderColor="#cccccc"
      initialPage={1}
      onFirstContent={onFirstContent}
    />
  );
}

function render(element: React.JSX.Element): void {
  act(() => {
    renderer = TestRenderer.create(element);
  });
}

beforeEach(() => {
  onFirstContent.mockClear();
  mockRecorded.flashList = null;
  mockUnits.status = 'loading';
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  mushafVerseMapService.clear();
});

describe('ReadingPageView (the horizontal list mode)', () => {
  it('reports once when a Hafs page commits its rows', () => {
    show('hafs');
    render(readingPage());
    expect(onFirstContent).toHaveBeenCalledTimes(1);

    act(() => renderer?.update(readingPage('#222222')));
    expect(onFirstContent).toHaveBeenCalledTimes(1);
  });

  it('does not report the spinner of a rewayah, then reports its rows once', () => {
    show('warsh');
    render(readingPage());
    expect(onFirstContent).not.toHaveBeenCalled();

    buildUnits('warsh');
    expect(onFirstContent).toHaveBeenCalledTimes(1);
  });

  it('reports the message of a rewayah whose verse units failed', () => {
    show('warsh');
    mockUnits.status = 'error';
    render(readingPage());
    expect(onFirstContent).toHaveBeenCalledTimes(1);

    buildUnits('warsh');
    expect(onFirstContent).toHaveBeenCalledTimes(1);
  });
});

describe('ContinuousListView (the vertical list mode)', () => {
  it('reports once, when the list has drawn its rows', () => {
    show('hafs');
    render(continuousList());
    expect(onFirstContent).not.toHaveBeenCalled();

    raiseListLoad();
    expect(onFirstContent).toHaveBeenCalledTimes(1);

    raiseListLoad();
    act(() => renderer?.update(continuousList('#222222')));
    expect(onFirstContent).toHaveBeenCalledTimes(1);
  });

  it('does not report the spinner of a rewayah, then reports its rows once', () => {
    show('warsh');
    render(continuousList());
    expect(mockRecorded.flashList).toBeNull();
    expect(onFirstContent).not.toHaveBeenCalled();

    buildUnits('warsh');
    expect(onFirstContent).not.toHaveBeenCalled();

    raiseListLoad();
    expect(onFirstContent).toHaveBeenCalledTimes(1);
  });

  it('reports the message of a rewayah whose verse units failed', () => {
    show('warsh');
    mockUnits.status = 'error';
    render(continuousList());
    expect(onFirstContent).toHaveBeenCalledTimes(1);
  });
});
