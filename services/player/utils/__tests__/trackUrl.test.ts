// @ai-generated
/**
 * A queue track's url is fixed when the queue is built. resolveTrackUrl()
 * picks the source again at load time: a file downloaded since then, a
 * stream when the download is gone, and a fresh path for local files.
 */

const mockReciters = new Map<string, {id: string}>();
const mockSmartUrl = jest.fn<string, [unknown, string, string | undefined]>();
const mockUploads: {id: string; filePath: string}[] = [];

jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: (id: string) => mockReciters.get(id),
}));
jest.mock('@/utils/audioUtils', () => ({
  generateSmartAudioUrl: (r: unknown, s: string, rw?: string) =>
    mockSmartUrl(r, s, rw),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({recitations: mockUploads})},
}));
jest.mock('@/services/uploads/UploadsService', () => ({
  resolveRecitationPath: (name: string) => `file:///now/uploads/${name}`,
}));
jest.mock('@/services/player/store/playerStore', () => ({
  setTrackUrlResolver: jest.fn(),
}));

import {resolveTrackUrl} from '../trackUrl';
import type {Track} from '@/types/audio';

const REMOTE = 'https://cdn.example.com/hafs/002.mp3';
const LOCAL_NOW = 'file:///now/downloads/r1-2-hafs.mp3';
const LOCAL_OLD = 'file:///old-container/downloads/r1-2-hafs.mp3';

function track(overrides: Partial<Track>): Track {
  return {
    id: 'r1:2',
    url: REMOTE,
    title: 'Al-Baqarah',
    artist: 'Reciter',
    reciterId: 'r1',
    reciterName: 'Reciter',
    surahId: '2',
    rewayatId: 'hafs',
    ...overrides,
  } as Track;
}

describe('resolveTrackUrl()', () => {
  beforeEach(() => {
    mockReciters.clear();
    mockReciters.set('r1', {id: 'r1'});
    mockUploads.length = 0;
    mockSmartUrl.mockReset();
  });

  it('keeps a remote url when the surah is not downloaded', () => {
    mockSmartUrl.mockReturnValue(REMOTE);
    expect(resolveTrackUrl(track({}))).toBe(REMOTE);
  });

  it('plays the file once the surah has been downloaded', () => {
    mockSmartUrl.mockReturnValue(LOCAL_NOW);
    expect(resolveTrackUrl(track({}))).toBe(LOCAL_NOW);
    expect(mockSmartUrl).toHaveBeenCalledWith({id: 'r1'}, '2', 'hafs');
  });

  it('streams again when the download behind a local url is gone', () => {
    mockSmartUrl.mockReturnValue(REMOTE);
    expect(resolveTrackUrl(track({url: LOCAL_OLD}))).toBe(REMOTE);
  });

  it('rebuilds a local path saved under an old app container', () => {
    mockSmartUrl.mockReturnValue(LOCAL_NOW);
    expect(resolveTrackUrl(track({url: LOCAL_OLD}))).toBe(LOCAL_NOW);
  });

  it('never swaps one remote url for another', () => {
    mockSmartUrl.mockReturnValue('https://cdn.example.com/other/002.mp3');
    expect(resolveTrackUrl(track({}))).toBe(REMOTE);
  });

  it('keeps the url of a track whose reciter is not in the catalogue', () => {
    mockReciters.clear();
    expect(resolveTrackUrl(track({}))).toBe(REMOTE);
    expect(mockSmartUrl).not.toHaveBeenCalled();
  });

  it('keeps the url when the reciter no longer has the rewayah', () => {
    mockSmartUrl.mockImplementation(() => {
      throw new Error('No rewayat found for reciter');
    });
    expect(resolveTrackUrl(track({}))).toBe(REMOTE);
  });

  it('rebuilds an upload path from its stored file name', () => {
    mockUploads.push({id: 'up1', filePath: 'my.mp3'});
    const upload = track({
      url: 'file:///old-container/uploads/my.mp3',
      isUserUpload: true,
      userRecitationId: 'up1',
    });
    expect(resolveTrackUrl(upload)).toBe('file:///now/uploads/my.mp3');
  });

  it('keeps the url of an upload that no longer exists', () => {
    const upload = track({
      url: 'file:///old-container/uploads/gone.mp3',
      isUserUpload: true,
      userRecitationId: 'gone',
    });
    expect(resolveTrackUrl(upload)).toBe(
      'file:///old-container/uploads/gone.mp3',
    );
  });
});
