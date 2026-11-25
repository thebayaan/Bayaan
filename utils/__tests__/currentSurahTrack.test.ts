// @ai-generated
import {isCurrentSurahTrack, isTrackForSurah} from '../currentSurahTrack';
import type {Track} from '@/types/audio';

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: 't1',
    url: 'https://cdn.example.com/t1.mp3',
    title: 'Al-Fatiha',
    artist: 'Reciter',
    reciterId: 'r1',
    reciterName: 'Reciter',
    surahId: '1',
    ...overrides,
  };
}

describe('isTrackForSurah', () => {
  it('matches the same reciter and surah', () => {
    expect(isTrackForSurah(track(), 'r1', 1, undefined)).toBe(true);
  });

  it('does not match another reciter or another surah', () => {
    expect(isTrackForSurah(track(), 'r2', 1, undefined)).toBe(false);
    expect(isTrackForSurah(track(), 'r1', 2, undefined)).toBe(false);
  });

  it('compares the rewayah only when both name one', () => {
    const hafs = track({rewayatId: 'hafs'});
    expect(isTrackForSurah(hafs, 'r1', 1, 'hafs')).toBe(true);
    expect(isTrackForSurah(hafs, 'r1', 1, 'warsh')).toBe(false);
    expect(isTrackForSurah(hafs, 'r1', 1, undefined)).toBe(true);
    expect(isTrackForSurah(track(), 'r1', 1, 'warsh')).toBe(true);
  });

  it('is false with no track or no reciter', () => {
    expect(isTrackForSurah(null, 'r1', 1, undefined)).toBe(false);
    expect(isTrackForSurah(undefined, 'r1', 1, undefined)).toBe(false);
    expect(isTrackForSurah(track(), undefined, 1, undefined)).toBe(false);
  });
});

describe('isCurrentSurahTrack', () => {
  const tracks = [track(), track({id: 't2', surahId: '2'})];

  it('checks the track at the current index', () => {
    expect(
      isCurrentSurahTrack({tracks, currentIndex: 1}, 'r1', 2, undefined),
    ).toBe(true);
    expect(
      isCurrentSurahTrack({tracks, currentIndex: 1}, 'r1', 1, undefined),
    ).toBe(false);
  });

  it('is false when the index is outside the queue', () => {
    expect(
      isCurrentSurahTrack({tracks, currentIndex: -1}, 'r1', 1, undefined),
    ).toBe(false);
    expect(
      isCurrentSurahTrack({tracks, currentIndex: 2}, 'r1', 1, undefined),
    ).toBe(false);
    expect(
      isCurrentSurahTrack({tracks: [], currentIndex: 0}, 'r1', 1, undefined),
    ).toBe(false);
  });
});
