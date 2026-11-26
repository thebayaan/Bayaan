// @ai-generated
/**
 * "Use default reciter" for a surah the default reciter has not recorded.
 * It used to add a Continue Listening card and send the player after a file
 * that does not exist.
 */
import React from 'react';
import {act, create} from 'react-test-renderer';
import type {Reciter} from '@/data/reciterData';

let mockSegments: string[] = [];
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  useRouter: () => ({push: mockPush}),
}));
const mockUpdateQueue = jest.fn(async () => undefined);
const mockPlay = jest.fn(async () => undefined);
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({updateQueue: mockUpdateQueue, play: mockPlay}),
}));
const mockStartNewChain = jest.fn();
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: (
    select: (state: {startNewChain: jest.Mock}) => unknown,
  ) => select({startNewChain: mockStartNewChain}),
}));
let mockReciters: Reciter[] = [];
jest.mock('@/services/dataService', () => ({
  getSurahById: (id: number) =>
    id >= 1 && id <= 114
      ? {id, name: `Surah ${id}`, name_arabic: `سورة ${id}`}
      : undefined,
  getAllReciters: async () => mockReciters,
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: {getState: () => ({reciterPreferences: {partial: 'warsh'}})},
}));
jest.mock('@/utils/track', () => ({
  createTracksForReciter: async (
    reciter: {id: string},
    surahs: {id: number}[],
    rewayatId: string,
  ) => surahs.map(s => ({id: `${reciter.id}-${s.id}`, rewayatId})),
}));
const mockToast = jest.fn();
jest.mock('@/utils/toastUtils', () => ({
  showToast: (...args: unknown[]) => mockToast(...args),
}));

import {useReciterSelection} from '@/hooks/useReciterSelection';

const partial = {
  id: 'partial',
  name: 'Partial Reciter',
  rewayat: [
    {id: 'hafs', surah_list: [1, 36]},
    {id: 'warsh', surah_list: [1]},
  ],
} as unknown as Reciter;

function renderHook() {
  let hook!: ReturnType<typeof useReciterSelection>;
  function Probe(): null {
    hook = useReciterSelection();
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSegments = ['(tabs)', '(b.search)'];
  mockReciters = [partial];
});

describe('playWithReciter', () => {
  it('plays a surah the reciter has, in a rewayah that has it', async () => {
    const hook = renderHook();
    let played: boolean | undefined;
    await act(async () => {
      played = await hook.playWithReciter(partial, '36');
    });

    expect(played).toBe(true);
    // The saved pick (warsh) lacks surah 36, so hafs plays.
    expect(mockStartNewChain).toHaveBeenCalledWith(
      partial,
      expect.objectContaining({id: 36}),
      0,
      0,
      'hafs',
    );
    expect(mockUpdateQueue).toHaveBeenCalledWith(
      [{id: 'partial-36', rewayatId: 'hafs'}],
      0,
    );
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not play a surah the reciter has not recorded', async () => {
    const hook = renderHook();
    let played: boolean | undefined;
    await act(async () => {
      played = await hook.playWithReciter(partial, '2');
    });

    expect(played).toBe(false);
    expect(mockStartNewChain).not.toHaveBeenCalled();
    expect(mockUpdateQueue).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('says so and opens the reciters who have the surah, in the same tab', async () => {
    const hook = renderHook();
    await act(async () => {
      await hook.playWithReciter(partial, '2');
    });

    expect(mockToast).toHaveBeenCalledWith(
      'Partial Reciter has not recorded Surah 2',
      'Choose another reciter for it.',
      'error',
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/(b.search)/reciter/browse',
      params: {view: 'all', surahId: 2},
    });
  });

  it('does nothing with the placeholder default reciter before the catalogue loads', async () => {
    // useReciterStore's default reciter until the catalogue arrives.
    const notLoaded = {
      id: '',
      name: '',
      date: null,
      image_url: null,
      rewayat: [],
    } as unknown as Reciter;
    const hook = renderHook();
    let played: boolean | undefined;
    await act(async () => {
      played = await hook.playWithReciter(notLoaded, '36');
    });

    expect(played).toBe(false);
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockStartNewChain).not.toHaveBeenCalled();
    expect(mockUpdateQueue).not.toHaveBeenCalled();
  });
});

describe('playWithRandomReciter', () => {
  it('only picks a reciter who has the surah', async () => {
    const other = {
      id: 'other',
      name: 'Other',
      rewayat: [{id: 'hafs', surah_list: [2]}],
    } as unknown as Reciter;
    mockReciters = [partial, other];
    const hook = renderHook();

    await act(async () => {
      await hook.playWithRandomReciter('2');
    });

    expect(mockStartNewChain).toHaveBeenCalledWith(
      other,
      expect.objectContaining({id: 2}),
      0,
      0,
      'hafs',
    );
  });

  it('plays nothing when no reciter has the surah', async () => {
    const hook = renderHook();
    let played: boolean | undefined;
    await act(async () => {
      played = await hook.playWithRandomReciter('2');
    });

    expect(played).toBe(false);
    expect(mockStartNewChain).not.toHaveBeenCalled();
    expect(mockUpdateQueue).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledTimes(1);
  });
});
