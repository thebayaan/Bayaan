// The helpers under test are pure; stub the store and service graph so the
// native-backed modules (expo-audio, MMKV) are never loaded.
jest.mock('@/modules/bayaan-car', () => ({BayaanCar: {isAvailable: false}}));
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {waitForPlayer: () => Promise.resolve()},
}));
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {setCarMode: jest.fn()},
}));
jest.mock('@/utils/track', () => ({
  createTrack: jest.fn(),
  shuffleTracks: jest.fn(),
}));
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {}}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {},
}));
jest.mock('@/services/player/store/lovedStore', () => ({useLovedStore: {}}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {},
}));
jest.mock('@/services/car/CarSnapshotService', () => ({
  getCachedPlaylistItems: jest.fn(),
  getLastTopReciterId: jest.fn(),
}));

import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {
  carriedProgress,
  toNowPlaying,
  nextRate,
  nextRepeat,
} from '../CarPlaybackBridge';

describe('CarPlaybackBridge helpers', () => {
  it('cycles playback rates 1, 1.25, 1.5, 0.75', () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(1.25)).toBe(1.5);
    expect(nextRate(1.5)).toBe(0.75);
    expect(nextRate(0.75)).toBe(1);
    expect(nextRate(2)).toBe(1);
  });

  it('cycles repeat none, queue, track', () => {
    expect(nextRepeat('none')).toBe('queue');
    expect(nextRepeat('queue')).toBe('track');
    expect(nextRepeat('track')).toBe('none');
  });

  it('maps an empty queue to null', () => {
    expect(
      toNowPlaying(
        {tracks: [], currentIndex: 0},
        {state: 'paused', position: 0, duration: 0, rate: 1},
        'none',
        false,
      ),
    ).toBeNull();
  });

  it('adds the current ayah after the reciter, not to queue rows', () => {
    const track = {
      id: 'a',
      url: 'u',
      title: 'Al-Kahf',
      artist: 'Mishary',
      reciterId: 'r1',
      reciterName: 'Mishary',
      surahId: '18',
    };
    const np = toNowPlaying(
      {tracks: [track], currentIndex: 0},
      {state: 'playing', position: 10, duration: 100, rate: 1},
      'none',
      false,
      'Ayah 12 of 110',
    );
    expect(np?.subtitle).toBe('Mishary · Ayah 12 of 110');
    expect(np?.queue[0].subtitle).toBe('Mishary');
  });

  it('maps the current track', () => {
    const np = toNowPlaying(
      {
        tracks: [
          {
            id: 'a',
            url: 'u',
            title: 'Al-Kahf',
            artist: 'Mishary',
            reciterId: 'r1',
            reciterName: 'Mishary',
            surahId: '18',
          },
        ],
        currentIndex: 0,
      },
      {state: 'playing', position: 10, duration: 100, rate: 1.25},
      'queue',
      true,
    );
    expect(np).toMatchObject({
      title: 'Al-Kahf',
      subtitle: 'Mishary',
      reciterId: 'r1',
      surahId: 18,
      isPlaying: true,
      position: 10,
      duration: 100,
      rate: 1.25,
      repeatMode: 'queue',
      isLoved: true,
      artwork: {kind: 'surah', surahId: 18},
      currentIndex: 0,
    });
  });
});

describe('carriedProgress', () => {
  function recentEntry(
    reciterId: string,
    surahId: number,
    duration: number,
    isUserUpload?: boolean,
  ): RecentlyPlayedTrack {
    return {
      reciter: {
        id: reciterId,
        name: reciterId,
        date: null,
        image_url: null,
        rewayat: [],
      },
      surah: {
        id: surahId,
        name: 's',
        revelation_place: 'Makkah',
        revelation_order: 1,
        bismillah_pre: false,
        name_arabic: 's',
        verses_count: 1,
        pages: '1',
        translated_name_english: 's',
      },
      rewayatId: 'w',
      progress: 0.4,
      duration,
      timestamp: 1,
      isUserUpload,
    };
  }
  const recent = [recentEntry('r1', 18, 200), recentEntry('r2', 18, 100, true)];

  it('keeps the resumed position as progress', () => {
    expect(carriedProgress(recent, 'r1', 18, 80)).toEqual({
      progress: 0.4,
      duration: 200,
    });
  });

  it('starts from zero for a fresh play or an unknown entry', () => {
    const zero = {progress: 0, duration: 0};
    expect(carriedProgress(recent, 'r1', 18, 0)).toEqual(zero);
    expect(carriedProgress(recent, 'r1', 2, 50)).toEqual(zero);
    expect(carriedProgress(recent, 'r2', 18, 50)).toEqual(zero);
  });

  it('caps progress at 1', () => {
    expect(carriedProgress(recent, 'r1', 18, 500).progress).toBe(1);
  });
});
