// @ai-generated
/**
 * A link to the open Mushaf reader (app/mushaf.tsx). A warm
 * bayaan://mushaf?page=N, or a link route's dismissTo, gives the reader route
 * new params without a remount; the screen then asks the open viewer to turn
 * (mushafNavigationStore.requestId rises). A surah-only link
 * (bayaan://quran/86) also names its surah, so the header shows At-Tariq on
 * page 591, where At-Tariq and Al-A'la start. A verse link also asks the
 * viewer to select its verse. Lives outside app/ because every file there is
 * bundled as a route.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockRoute: {params: Record<string, string>} = {params: {}};
const mockData = {ready: true};
const mockViewer: {page?: number} = {};

// Recitation follow-along pulls in native audio and ONNX modules.
jest.mock('@/services/recitation/RecitationTrackingService', () => ({
  stopRecitationTracking: jest.fn(),
}));
jest.mock('@/components/mushaf/RecitationMicButton', () => ({
  RecitationMicButton: () => null,
  useRecitationFollowAlong: jest.fn(),
  useRecitationStatusText: () => null,
  useRecitationMic: () => ({
    enabled: false,
    status: 'off',
    progress: 0,
    busy: false,
    toggle: jest.fn(),
  }),
}));
jest.mock('expo-router', () => ({
  Stack: {Toolbar: () => null},
  useLocalSearchParams: () => ({...mockRoute.params}),
  // React Navigation gives the route a new params object for each link.
  useRoute: () => mockRoute,
}));

jest.mock('expo-screen-orientation', () => ({
  unlockAsync: jest.fn(),
  lockAsync: jest.fn(),
  OrientationLock: {PORTRAIT_UP: 1},
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {background: '#fff', text: '#111'}}}),
}));

jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));

// The viewer is not under test: the page it mounts on and the request it
// reads are.
jest.mock('@/components/mushaf/main', () => ({
  __esModule: true,
  default: ({pageNumber}: {pageNumber: number}) => {
    mockViewer.page = pageNumber;
    return null;
  },
}));

jest.mock('@/hooks/useMushafData', () => ({
  useMushafData: () =>
    mockData.ready
      ? {state: 'ready', retry: jest.fn()}
      : {state: 'loading', retry: jest.fn()},
}));

const mockPages: Record<string, number> = {'2:255': 42, '106:4': 602};
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getSurahStartPages: () => ({1: 1, 86: 591, 87: 591, 106: 602}),
    getPageForVerse: (key: string) => mockPages[key] ?? 0,
    getPageForWord: (key: string) => mockPages[key],
  },
}));

jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {setLastScreenWasMushaf: jest.fn()},
}));

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));

jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));

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

// The shown rewayah's verse holding an anchor's slot (Warsh 106:5 holds
// Hafs 106:4 word 5); none for any other anchor.
const mockAnchorUnits: Record<string, {key: string; hafsKeys: string[]}> = {};
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: () => [],
    isShownVerseUnitsPending: () => false,
  },
  selectionForAnchor: (anchor: string) => {
    const unit = mockAnchorUnits[anchor];
    return unit ? {rewayah: 'warsh', units: [{...unit, anchor}]} : null;
  },
  whenShownVerseUnitsResolved: () => Promise.resolve(),
}));

import MushafScreen from '@/app/mushaf';
import {useMushafNavigationStore} from '@/store/mushafNavigationStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {useMushafWordFlashStore} from '@/store/mushafWordFlashStore';
import {quranHitOpenParams} from '@/utils/search/quranHitParams';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

/** The reader route gets params: at mount, or from a link (a new object). */
function route(params: Record<string, string>): void {
  mockRoute.params = params;
  act(() => {
    if (renderer) renderer.update(<MushafScreen />);
    else renderer = TestRenderer.create(<MushafScreen />);
  });
}

const request = () => useMushafNavigationStore.getState();

beforeEach(() => {
  mockData.ready = true;
  mockViewer.page = undefined;
  useMushafNavigationStore.setState({
    targetPage: null,
    targetVerseKey: null,
    targetSurahId: null,
    requestId: 0,
  });
  useMushafVerseSelectionStore.getState().clearSelection();
  useMushafWordFlashStore.getState().clear();
  for (const key of Object.keys(mockAnchorUnits)) delete mockAnchorUnits[key];
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
});

it('the mount asks for nothing: the viewer opens on the page itself', () => {
  route({page: '50'});
  act(() => renderer?.update(<MushafScreen />));
  expect(mockViewer.page).toBe(50);
  expect(request().requestId).toBe(0);
});

it('a page link to the open reader asks the viewer for that page', () => {
  route({page: '50'});
  route({page: '100'});
  expect(request()).toMatchObject({
    requestId: 1,
    targetPage: 100,
    targetSurahId: null,
  });
});

it('a second link to the same page asks again (the reader may have turned)', () => {
  route({page: '50'});
  route({page: '50'});
  expect(request()).toMatchObject({requestId: 1, targetPage: 50});
});

it('a surah link asks for its first page and names the surah', () => {
  route({page: '50'});
  route({surah: '86'});
  expect(request()).toMatchObject({
    requestId: 1,
    targetPage: 591,
    targetSurahId: 86,
  });
});

it('a verse link with no page asks for the page of the verse', () => {
  route({page: '50'});
  route({surah: '2', ayah: '255'});
  expect(request()).toMatchObject({requestId: 1, targetPage: 42});
});

it('a page link asks for no verse to select', () => {
  route({surah: '2', ayah: '255', page: '42'});
  route({page: '100'});
  expect(request()).toMatchObject({requestId: 1, targetVerseKey: null});
});

it('a verse link to the open reader asks to select that verse', () => {
  route({page: '50'});
  route({surah: '2', ayah: '255'});
  expect(request()).toMatchObject({
    requestId: 1,
    targetPage: 42,
    targetVerseKey: '2:255',
  });
});

it('a second link to the open verse asks to select it again', () => {
  route({surah: '2', ayah: '255', page: '42'});
  route({surah: '2', ayah: '255', page: '42'});
  expect(request()).toMatchObject({
    requestId: 1,
    targetPage: 42,
    targetVerseKey: '2:255',
  });
});

it('a link while the reader still loads: the viewer mounts on its page', () => {
  mockData.ready = false;
  route({page: '50'});
  route({page: '60'});
  mockData.ready = true;
  act(() => renderer?.update(<MushafScreen />));
  expect(mockViewer.page).toBe(60);
  expect(request().requestId).toBe(0);
});

// A Quran search hit handed to the open reader (root search in the verse
// sheet over it: useOpenQuranHit) flashes its words, as it does when it
// opens the reader (MushafScreenSavedVerseOpen.test.tsx).
it('a search hit to the open reader turns to it and flashes its words', () => {
  route({page: '50'});
  route(quranHitOpenParams('2:255', [4, 3]));
  expect(request()).toMatchObject({
    requestId: 1,
    targetPage: 42,
    targetVerseKey: '2:255',
  });
  expect(useMushafWordFlashStore.getState().flash).toMatchObject({
    verseKey: '2:255',
    positions: [3, 4],
  });
});

it("a hit selects exactly the shown rewayah's verse holding its first word", () => {
  // Warsh 106:5 is the later part of Hafs 106:4: a hit on Hafs 106:4 word
  // 5 selects it alone, not every Warsh verse holding Hafs 106:4.
  mockAnchorUnits['106:4:5'] = {key: '106:5', hafsKeys: ['106:4']};
  route({page: '50'});
  route(quranHitOpenParams('106:4', [5, 6]));
  expect(request()).toMatchObject({
    requestId: 1,
    targetPage: 602,
    targetVerseKey: null,
  });
  expect(useMushafVerseSelectionStore.getState()).toMatchObject({
    selectedRewayah: 'warsh',
    selectedVerseKeys: ['106:5'],
    selectedPageNumber: 602,
  });
  expect(useMushafWordFlashStore.getState().flash).toMatchObject({
    verseKey: '106:4',
    positions: [5, 6],
  });
});

it('a link with no words flashes no words', () => {
  route({page: '50'});
  route({surah: '2', ayah: '255'});
  expect(request().requestId).toBe(1);
  expect(useMushafWordFlashStore.getState().flash).toBeNull();
});

// The verse a hit selects here is not sent to the viewer, which ends only
// the flash of a verse it selects itself: it stayed lit until a verse sheet
// closed or the reader was left.
it("a hit's verse goes after 3 s; a verse selected meanwhile stays", () => {
  jest.useFakeTimers();
  try {
    mockAnchorUnits['106:4:5'] = {key: '106:5', hafsKeys: ['106:4']};
    const keys = () =>
      useMushafVerseSelectionStore.getState().selectedVerseKeys;
    route({page: '50'});
    route(quranHitOpenParams('106:4', [5, 6]));
    act(() => jest.advanceTimersByTime(2999));
    expect(keys()).toEqual(['106:5']);
    act(() => jest.advanceTimersByTime(1));
    expect(keys()).toEqual([]);

    route(quranHitOpenParams('106:4', [5, 6]));
    act(() => jest.advanceTimersByTime(1000));
    act(() => {
      useMushafVerseSelectionStore.getState().selectVerse('106:3', 602);
    });
    act(() => jest.advanceTimersByTime(5000));
    expect(keys()).toEqual(['106:3']);
  } finally {
    act(() => renderer?.unmount());
    renderer = null;
    jest.useRealTimers();
  }
});
