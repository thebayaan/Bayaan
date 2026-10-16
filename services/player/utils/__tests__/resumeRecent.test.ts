import {resumeRecent} from '../resumeRecent';
import type {Track} from '@/types/audio';

const mockResumeChain = jest.fn();

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
    getState: () => ({resumeChain: mockResumeChain}),
  },
}));

describe('resumeRecent', () => {
  beforeEach(() => mockResumeChain.mockReset());

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
