// @ai-generated
/**
 * The flash of the mushaf screen (app/mushaf.tsx) opened on a stored anchor
 * (a bookmark saved in Warsh: 'S:A:W', the later part of a split Hafs
 * verse): exactly the shown rewayah's verse holding that slot. Verse units
 * are built after interactions, never on the screen's mount, so right after
 * the rewayah switch that opening a bookmark makes they may still be
 * building: the screen waits for them instead of flashing every verse
 * holding the anchor's Hafs verse meanwhile. A flash of a Hafs verse (no
 * anchor) waits too, as the pages paint no verse layer until they are
 * built. Lives outside app/ because every file there is bundled as a route.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockParams: Record<string, string> = {};
const mockShown: {pending: boolean; built: (() => void) | null} = {
  pending: false,
  built: null,
};

jest.mock('expo-router', () => ({
  Stack: {Toolbar: () => null},
  useLocalSearchParams: () => mockParams,
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

jest.mock('@/components/mushaf/main', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: true,
    rewayah: 'warsh',
    getSurahStartPages: () => ({1: 1}),
    switchRewayah: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {
    state: 'ready',
    subscribe: () => () => undefined,
    initialize: () => Promise.resolve(),
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

// Warsh shown: the anchor '1:7:5' is Warsh 1:7 once its units are built;
// while they are, there is no unit to name.
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: () => [],
    isShownVerseUnitsPending: () => mockShown.pending,
  },
  selectionForAnchor: (anchor: string) =>
    mockShown.pending
      ? null
      : {
          rewayah: 'warsh',
          units: [{key: '1:7', anchor, hafsKeys: ['1:7']}],
        },
  whenShownVerseUnitsResolved: () =>
    new Promise(resolve => {
      mockShown.built = () => {
        mockShown.pending = false;
        resolve(null);
      };
    }),
}));

import MushafScreen from '@/app/mushaf';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

function open(params: Record<string, string>): void {
  Object.assign(mockParams, params);
  act(() => {
    renderer = TestRenderer.create(<MushafScreen />);
  });
}

const selection = () => {
  const s = useMushafVerseSelectionStore.getState();
  return {rewayah: s.selectedRewayah, keys: s.selectedVerseKeys};
};

beforeEach(() => {
  jest.useFakeTimers();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
  mockShown.pending = false;
  mockShown.built = null;
  useMushafVerseSelectionStore.getState().clearSelection();
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
  jest.useRealTimers();
});

const WARSH_BOOKMARK = {page: '1', surah: '1', ayah: '7', anchor: '1:7:5'};

it('units still building: waits, then flashes exactly the verse', async () => {
  mockShown.pending = true;
  open(WARSH_BOOKMARK);
  // Not Hafs 1:7 meanwhile (it would light Warsh 1:6 and 1:7).
  expect(selection()).toEqual({rewayah: null, keys: []});

  await act(async () => {
    mockShown.built?.();
  });
  expect(selection()).toEqual({rewayah: 'warsh', keys: ['1:7']});
  act(() => jest.advanceTimersByTime(3000));
  expect(selection()).toEqual({rewayah: null, keys: []});
});

it('units built: flashes the verse at once, as before', () => {
  open(WARSH_BOOKMARK);
  expect(selection()).toEqual({rewayah: 'warsh', keys: ['1:7']});
  act(() => jest.advanceTimersByTime(3000));
  expect(selection()).toEqual({rewayah: null, keys: []});
});

it('closed while the units build: never flashes', async () => {
  mockShown.pending = true;
  open(WARSH_BOOKMARK);
  act(() => renderer?.unmount());
  renderer = null;
  await act(async () => {
    mockShown.built?.();
  });
  expect(selection()).toEqual({rewayah: null, keys: []});
});

// A Hafs verse (search, a Hafs bookmark, the player) is painted through the
// same verse layers, which stay empty while the units build: its 3 s start
// once they are built, not before.
it('no anchor, units still building: waits, then flashes the Hafs verse for 3 s', async () => {
  mockShown.pending = true;
  open({page: '1', surah: '1', ayah: '7'});
  expect(selection()).toEqual({rewayah: null, keys: []});
  act(() => jest.advanceTimersByTime(5000));
  expect(selection()).toEqual({rewayah: null, keys: []});

  await act(async () => {
    mockShown.built?.();
  });
  expect(selection()).toEqual({rewayah: 'hafs', keys: ['1:7']});
  act(() => jest.advanceTimersByTime(2999));
  expect(selection()).toEqual({rewayah: 'hafs', keys: ['1:7']});
  act(() => jest.advanceTimersByTime(1));
  expect(selection()).toEqual({rewayah: null, keys: []});
});

it('no anchor, units built: the Hafs verse at once, as before', () => {
  open({page: '1', surah: '1', ayah: '7'});
  expect(selection()).toEqual({rewayah: 'hafs', keys: ['1:7']});
});
