// @ai-generated
// A car resume must start where the listener really is. The plan's position
// comes from the snapshot the car is showing, which can be a tenth of the
// surah behind.
import type {Track} from '@/types/audio';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';

jest.mock('@/modules/bayaan-car', () => ({BayaanCar: {isAvailable: false}}));
jest.mock('@/services/audio/ExpoAudioService', () => ({expoAudioService: {}}));
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {setCarMode: jest.fn()},
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/data/systemPlaylists', () => ({getSystemPlaylists: () => []}));
jest.mock('@/utils/track', () => ({}));
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {}}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {},
}));
jest.mock('@/services/player/store/lovedStore', () => ({useLovedStore: {}}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {},
}));
jest.mock('@/services/car/CarSnapshotService', () => ({}));
jest.mock('@/services/car/carAyah', () => ({startCarAyahTracker: jest.fn()}));

import {liveResumePosition} from '../CarPlaybackBridge';

function track(surahId: string, rewayatId = 'hafs', reciterId = 'r1'): Track {
  return {
    id: `${reciterId}:${surahId}`,
    url: 'u',
    title: 't',
    artist: 'R1',
    reciterId,
    reciterName: 'R1',
    surahId,
    rewayatId,
  };
}

function recent(
  surahId: number,
  progress: number,
  rewayatId = 'hafs',
): RecentlyPlayedTrack {
  return {
    reciter: {id: 'r1', name: 'R1', date: null, image_url: null, rewayat: []},
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
    rewayatId,
    progress,
    duration: 1000,
    timestamp: 1,
  };
}

describe('liveResumePosition', () => {
  it('uses the player position when it already holds that surah', () => {
    // Snapshot saw 30%; the listener paused at 38%.
    expect(
      liveResumePosition(track('2'), 300, {
        current: track('2'),
        position: 380,
        recentTracks: [recent(2, 0.37)],
      }),
    ).toBe(380);
  });

  it('uses the recent card as it is now when the player holds something else', () => {
    expect(
      liveResumePosition(track('2'), 300, {
        current: track('3'),
        position: 12,
        recentTracks: [recent(3, 0.01), recent(2, 0.38)],
      }),
    ).toBe(380);
  });

  it('does not take the position of the same surah in another rewayah', () => {
    expect(
      liveResumePosition(track('2', 'warsh'), 300, {
        current: track('2', 'hafs'),
        position: 900,
        recentTracks: [recent(2, 0.9, 'hafs')],
      }),
    ).toBe(300);
  });

  it('does not take the position of the same surah by another reciter', () => {
    expect(
      liveResumePosition(track('2', 'hafs', 'r2'), 300, {
        current: track('2', 'hafs', 'r1'),
        position: 900,
        recentTracks: [recent(2, 0.9)],
      }),
    ).toBe(300);
  });

  it('falls back to the plan when nothing live knows the surah', () => {
    expect(
      liveResumePosition(track('2'), 300, {
        current: undefined,
        position: 0,
        recentTracks: [],
      }),
    ).toBe(300);
  });

  it('restarts a surah the player has gone back to the start of', () => {
    expect(
      liveResumePosition(track('2'), 300, {
        current: track('2'),
        position: 0,
        recentTracks: [recent(2, 0.3)],
      }),
    ).toBe(0);
  });
});
