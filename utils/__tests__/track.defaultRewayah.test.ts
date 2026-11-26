// @ai-generated
/**
 * createTrack() and createDownloadedTrack() with no rewayah asked for: the
 * track takes the first rewayah that has the surah, not the first rewayah.
 */
jest.mock('@/utils/audioUtils', () => ({
  generateSmartAudioUrl: (
    reciter: {id: string},
    surahId: string,
    rewayatId?: string,
  ) => `https://cdn.test/${reciter.id}/${rewayatId ?? 'none'}/${surahId}.mp3`,
}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => 'art'}));
jest.mock('@/services/downloadService', () => ({
  resolveFilePath: (name: string) => `file:///docs/${name}`,
}));
jest.mock('@/services/uploads/UploadsService', () => ({
  resolveRecitationPath: (path: string) => path,
}));
jest.mock('@/services/dataService', () => ({
  getSurahById: jest.fn(),
  getReciterName: jest.fn(),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {getState: () => ({recentTracks: []})},
}));
jest.mock('@/i18n', () => ({t: (key: string) => key}));

import type {Reciter, Rewayat} from '@/data/reciterData';
import type {Surah} from '@/data/surahData';
import {createDownloadedTrack, createTrack} from '../track';

function rewayah(id: string, surahs: number[]): Rewayat {
  return {
    id,
    reciter_id: 'r1',
    name: id,
    style: 'murattal',
    server: `https://cdn.test/${id}`,
    surah_total: surahs.length,
    surah_list: surahs,
    source_type: 'test',
    created_at: '',
  };
}

// The first rewayah has a few surahs only; the second has Al-Fatihah.
const reciter: Reciter = {
  id: 'r1',
  name: 'Reciter',
  date: null,
  image_url: null,
  rewayat: [rewayah('partial', [112, 113, 114]), rewayah('full', [1, 2, 114])],
};

const surah = (id: number): Surah => ({id, name: `Surah ${id}`}) as Surah;

describe('createTrack with no rewayah', () => {
  it('takes the first rewayah that has the surah', async () => {
    const track = await createTrack(reciter, surah(1));
    expect(track.rewayatId).toBe('full');
    expect(track.url).toBe('https://cdn.test/r1/full/1.mp3');
  });

  it('keeps the first rewayah when it has the surah', async () => {
    const track = await createTrack(reciter, surah(114));
    expect(track.rewayatId).toBe('partial');
    expect(track.url).toBe('https://cdn.test/r1/partial/114.mp3');
  });

  it('keeps the first rewayah when no rewayah has the surah', async () => {
    expect((await createTrack(reciter, surah(50))).rewayatId).toBe('partial');
  });

  it('keeps the rewayah that the caller asked for', async () => {
    const track = await createTrack(reciter, surah(114), 'full');
    expect(track.rewayatId).toBe('full');
    expect(track.url).toBe('https://cdn.test/r1/full/114.mp3');
  });
});

describe('createDownloadedTrack with no rewayah', () => {
  it('takes the first rewayah that has the surah', () => {
    const track = createDownloadedTrack(reciter, surah(2), 'r1-2.mp3');
    expect(track.rewayatId).toBe('full');
    expect(track.url).toBe('file:///docs/r1-2.mp3');
  });
});
