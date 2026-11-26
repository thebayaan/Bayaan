import {resumeRecent} from '../resumeRecent';
import type {Track} from '@/types/audio';

const mockResumeChain = jest.fn();
// @ai The recents list as it is when the queue has loaded.
let mockRecentTracks: object[] = [];

jest.mock('@/services/dataService', () => ({
  getReciterById: async (id: string) =>
    id === 'r1'
      ? {id: 'r1', name: 'R', rewayat: [{id: 'rw-default'}]}
      : undefined,
  getSurahById: (id: number) => ({id, name: `S${id}`}),
  getAvailableSurahsForRewayat: async () => [1, 2, 3],
}));
jest.mock('@/utils/track', () => ({
  createTracksForReciter: async () => [{id: 'fallback'}],
}));
jest.mock('@/utils/audioUtils', () => ({
  generateSmartAudioUrl: (_r: unknown, surahId: string) => `u${surahId}`,
}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => 'art'}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {
    getState: () => ({
      resumeChain: mockResumeChain,
      recentTracks: mockRecentTracks, // @ai
    }),
  },
}));

describe('resumeRecent', () => {
  beforeEach(() => {
    mockResumeChain.mockReset();
    mockRecentTracks = []; // @ai
  });

  it('queues the rewayah from the surah at the saved position', async () => {
    const calls: {tracks: Track[]; index?: number; start?: number}[] = [];
    await resumeRecent({
      reciterId: 'r1',
      surahId: 2,
      rewayatId: 'rw1',
      startPosition: 90,
      recentIndex: 3,
      updateQueue: async (tracks, index, start) => {
        calls.push({tracks, index, start});
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].tracks.map(t => t.surahId)).toEqual(['2', '3', '1']);
    expect(calls[0].tracks[0].rewayatId).toBe('rw1');
    expect(calls[0].index).toBe(0);
    expect(calls[0].start).toBe(90);
    expect(mockResumeChain).toHaveBeenCalledWith(3);
  });

  // @ai-start
  const entry = (reciterId: string, surahId: number, rewayatId = 'rw1') => ({
    reciter: {id: reciterId},
    surah: {id: surahId},
    rewayatId,
  });

  // A progress tick for the track that just started can move its card to
  // the front while the queue loads. The place the card had when it was
  // pressed then belongs to another card, which must not be promoted.
  it('promotes the resumed entry where it is now, not where it was pressed', async () => {
    mockRecentTracks = [entry('r9', 5), entry('r8', 7), entry('r1', 2)];
    await resumeRecent({
      reciterId: 'r1',
      surahId: 2,
      rewayatId: 'rw1',
      startPosition: 90,
      recentIndex: 2,
      updateQueue: async () => {
        // The tick: the resumed card is already at the front.
        mockRecentTracks = [entry('r1', 2), entry('r9', 5), entry('r8', 7)];
      },
    });
    expect(mockResumeChain).toHaveBeenCalledTimes(1);
    expect(mockResumeChain).toHaveBeenCalledWith(0);
  });

  it('does not take the same surah in another rewayah or an upload for it', async () => {
    mockRecentTracks = [
      entry('r1', 2, 'other'),
      {...entry('r1', 2), isUserUpload: true},
      entry('r1', 2),
    ];
    await resumeRecent({
      reciterId: 'r1',
      surahId: 2,
      rewayatId: 'rw1',
      startPosition: 0,
      recentIndex: 1,
      updateQueue: async () => undefined,
    });
    expect(mockResumeChain).toHaveBeenCalledWith(2);
  });
  // @ai-end

  // A card saved without a rewayah plays the reciter's first one, and the
  // tick that moves the card to the front gives it that rewayah. The place
  // it had when pressed then belongs to its neighbour.
  it('finds a card saved without a rewayah after a tick gave it the queued one', async () => {
    mockRecentTracks = [entry('r9', 5), entry('r1', 2, '')];
    await resumeRecent({
      reciterId: 'r1',
      surahId: 2,
      rewayatId: '',
      startPosition: 90,
      recentIndex: 1,
      updateQueue: async () => {
        mockRecentTracks = [entry('r1', 2, 'rw-default'), entry('r9', 5)];
      },
    });
    expect(mockResumeChain).toHaveBeenCalledTimes(1);
    expect(mockResumeChain).toHaveBeenCalledWith(0);
  });

  it('does nothing for an unknown reciter', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const updateQueue = jest.fn();
    await resumeRecent({
      reciterId: 'missing',
      surahId: 2,
      startPosition: 0,
      recentIndex: 0,
      updateQueue,
    });
    expect(updateQueue).not.toHaveBeenCalled();
    expect(mockResumeChain).not.toHaveBeenCalled();
  });
});
