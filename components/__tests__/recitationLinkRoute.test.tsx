// @ai-generated
/**
 * The recitation link route (app/reciter/[slug]/[surah].tsx). The route
 * lives in app/, so its test lives here.
 *
 * - It used to redirect to the Home tab from the root stack, which stacks a
 *   second copy of the tab navigator: Back from Home led to another Home.
 *   It now steps off the root stack like the other link routes.
 * - It accepted any number as the surah (0, 115) and surahs the rewayah does
 *   not have, and queued a track that could not load.
 */
import React from 'react';
import {act, create} from 'react-test-renderer';

type Params = {slug?: string; surah?: string; rewayah?: string; t?: string};

let mockParams: Params = {};
let mockInitialized = true;
let mockStoreListener: ((state: {isInitialized: boolean}) => void) | null =
  null;
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockUpdateQueue = jest.fn<Promise<void>, [unknown[], number]>();
const mockSeekTo = jest.fn<Promise<void>, [number]>();
const mockNavigation = {
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({push: mockPush, replace: mockReplace}),
  useNavigation: () => mockNavigation,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {text: '#111', background: '#fff'}}}),
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: {
    getState: () => ({isInitialized: mockInitialized}),
    subscribe: (listener: (state: {isInitialized: boolean}) => void) => {
      mockStoreListener = listener;
      return () => {
        mockStoreListener = null;
      };
    },
  },
}));
jest.mock('@/services/dataService', () => ({
  getReciterBySlug: (slug: string) =>
    slug === 'mishary'
      ? {
          id: 'r1',
          name: 'Mishary',
          slug: 'mishary',
          rewayat: [
            {id: 'hafs', surah_list: []},
            // A partial rewayah: only the last three surahs.
            {id: 'warsh', surah_list: [112, 113, 114]},
          ],
        }
      : undefined,
}));
jest.mock('@/utils/audioUtils', () => ({
  generateSmartAudioUrl: (
    reciter: {id: string},
    surahId: string,
    rewayatId: string,
  ) => `https://audio.test/${reciter.id}/${rewayatId}/${surahId}.mp3`,
}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => 'art'}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({updateQueue: mockUpdateQueue, seekTo: mockSeekTo}),
  },
}));

import RecitationDeepLinkReceiver from '@/app/reciter/[slug]/[surah]';

async function openLink(params: Params): Promise<void> {
  mockParams = params;
  await act(async () => {
    create(<RecitationDeepLinkReceiver />);
  });
  // The route leaves a frame after mounting.
  await act(async () => {
    jest.advanceTimersByTime(32);
  });
}

async function settle(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockInitialized = true;
  mockStoreListener = null;
  mockNavigation.canGoBack.mockReturnValue(true);
  mockUpdateQueue.mockResolvedValue(undefined);
  mockSeekTo.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('a link to a recitation', () => {
  it('goes back to the tabs already open, plays the surah and shows the reciter', async () => {
    await openLink({slug: 'mishary', surah: '2'});

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockUpdateQueue).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'r1:2',
          url: 'https://audio.test/r1/hafs/2.mp3',
          title: 'Al-Baqarah',
          reciterId: 'r1',
          surahId: '2',
          rewayatId: 'hafs',
        }),
      ],
      0,
    );

    await settle();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/(a.home)/reciter/[id]',
      params: {id: 'r1'},
    });
    // A redirect from here is what stacked a second tab navigator.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('plays the rewayah and the position the link names', async () => {
    await openLink({slug: 'mishary', surah: '113', rewayah: 'warsh', t: '90'});
    await settle();

    expect(mockUpdateQueue.mock.calls[0][0]).toEqual([
      expect.objectContaining({surahId: '113', rewayatId: 'warsh'}),
    ]);
    expect(mockSeekTo).toHaveBeenCalledWith(90);
  });

  it('waits for the reciter catalogue when it has not loaded yet', async () => {
    mockInitialized = false;
    await openLink({slug: 'mishary', surah: '2'});
    expect(mockUpdateQueue).not.toHaveBeenCalled();

    mockInitialized = true;
    await act(async () => {
      mockStoreListener?.({isInitialized: true});
    });

    expect(mockUpdateQueue).toHaveBeenCalledTimes(1);
  });
});

describe('a link that names nothing playable', () => {
  it.each([
    ['surah 0', {slug: 'mishary', surah: '0'}],
    ['surah 115', {slug: 'mishary', surah: '115'}],
    ['a surah that is not a number', {slug: 'mishary', surah: 'abc'}],
    ['a number with junk after it', {slug: 'mishary', surah: '2abc'}],
    [
      'a surah this rewayah does not have',
      {slug: 'mishary', surah: '2', rewayah: 'warsh'},
    ],
    ['an unknown reciter', {slug: 'nobody', surah: '2'}],
  ])('%s: leaves the route and queues nothing', async (_name, params) => {
    await openLink(params);
    await settle();

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockUpdateQueue).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
