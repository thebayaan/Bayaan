// @ai-generated
/**
 * The Mushaf list views follow the selected translation.
 *
 * They hold verse objects taken from the shared verse data: the vertical
 * list in a module-level array built once, the paged list in a per-page
 * cache. Both were kept forever, so after another translation was applied
 * the rows still showed the previous one's text (under the new one's name)
 * for the rest of the session, and on every page already visited.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface MockVerseItemProps {
  verse: {verse_key: string; translation?: string};
}
interface MockFlashListProps {
  data: unknown[];
  extraData?: unknown;
  renderItem: (info: {item: unknown; index: number}) => React.ReactNode;
}

// Translation shown by each verse row, as of its latest render.
const mockShown = new Map<string, string | undefined>();
const mockRecorded = {flashList: null as MockFlashListProps | null};

jest.mock('@/components/player/v2/PlayerContent/QuranView/VerseItem', () => ({
  VerseItem: (props: MockVerseItemProps) => {
    mockShown.set(props.verse.verse_key, props.verse.translation);
    return null;
  },
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
jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual('react');
  const FlashList = ReactActual.forwardRef(
    (props: MockFlashListProps, _ref: unknown) => {
      mockRecorded.flashList = props;
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        props.data
          .slice(0, 8)
          .map((item: unknown, index: number) =>
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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => null,
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
    }),
  };
});
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: () => null}),
}));
jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {getThemeForVerse: () => undefined},
}));
const mockGetAllVerses = jest.fn();
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {
    getAllVerses: (...args: unknown[]) => mockGetAllVerses(...args),
  },
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
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {rebuildEnhancedVerses} from '@/utils/enhancedVerseData';
import type {FakeDKService} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';
import {
  fixtureLines,
  fixtureWords,
} from '@/services/mushaf/__fixtures__/verseUnitPages';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const dk = digitalKhattDataService as unknown as FakeDKService;

const SAHEEH_1_2 =
  '[All] praise is [due] to Allāh, Lord<sup foot_note="226404">1</sup> of the worlds -';
const CLEAR_QURAN_1_2 = 'All praise is for Allah—Lord of all worlds,';

let renderer: TestRenderer.ReactTestRenderer | null = null;

/** Applies a translation the way the app does: outside any component. */
async function apply(translationId: string): Promise<void> {
  await act(async () => {
    await rebuildEnhancedVerses(translationId);
  });
}

beforeAll(() => {
  dk.loadData({
    rewayah: 'hafs',
    words: fixtureWords('hafs'),
    lines: fixtureLines(),
  });
  useMushafSettingsStore.setState({
    rewayah: 'hafs',
    mushafRenderer: 'dk_v2',
    showTranslation: true,
  });
});

afterAll(() => mushafVerseMapService.clear());

beforeEach(async () => {
  mockGetAllVerses.mockReset();
  await rebuildEnhancedVerses('saheeh');
  mockShown.clear();
  mockRecorded.flashList = null;
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

function renderPage(): void {
  act(() => {
    renderer = TestRenderer.create(
      <ReadingPageView
        pageNumber={1}
        textColor="#111111"
        surahLabel="Al-Fatihah"
        juzLabel="Juz 1"
        pageLabel="1"
        labelColor="#666666"
        borderColor="#cccccc"
        cardColor="#ffffff"
        bgColor="#fafafa"
        isBookLayout={false}
        pageSize={{width: 390, height: 844}}
      />,
    );
  });
}

function renderList(): void {
  act(() => {
    renderer = TestRenderer.create(
      <ContinuousListView
        textColor="#111111"
        labelColor="#666666"
        borderColor="#cccccc"
        initialPage={1}
        width={390}
      />,
    );
  });
}

describe('the paged list view (ReadingPageView)', () => {
  it('shows the newly applied translation on a page that is already open', async () => {
    renderPage();
    expect(mockShown.get('1:2')).toBe(SAHEEH_1_2);
    await apply('clear-quran');
    expect(mockShown.get('1:2')).toBe(CLEAR_QURAN_1_2);
  });

  it('shows it on a page visited before the change', async () => {
    renderPage();
    act(() => renderer?.unmount());
    renderer = null;
    await apply('clear-quran');
    mockShown.clear();
    renderPage();
    expect(mockShown.get('1:2')).toBe(CLEAR_QURAN_1_2);
  });

  it('shows a downloaded translation once it has been read', async () => {
    mockGetAllVerses.mockResolvedValue({'1:2': 'urdu 1:2'});
    renderPage();
    await apply('ur.jalandhry');
    expect(mockShown.get('1:2')).toBe('urdu 1:2');
  });
});

describe('the vertical list view (ContinuousListView)', () => {
  it('shows the newly applied translation in the open list', async () => {
    renderList();
    expect(mockShown.get('1:2')).toBe(SAHEEH_1_2);
    const before = mockRecorded.flashList;
    await apply('clear-quran');
    expect(mockShown.get('1:2')).toBe(CLEAR_QURAN_1_2);
    // The list is told its rows changed.
    expect(mockRecorded.flashList?.data).not.toBe(before?.data);
    expect(mockRecorded.flashList?.extraData).not.toBe(before?.extraData);
  });

  it('shows it in a list opened after the change', async () => {
    renderList();
    act(() => renderer?.unmount());
    renderer = null;
    await apply('clear-quran');
    mockShown.clear();
    renderList();
    expect(mockShown.get('1:2')).toBe(CLEAR_QURAN_1_2);
  });
});
