import {resumeNewestContinue} from './continueResume';
import {getContinueListening} from './continueListeningStore';
import {playOrOpen} from './playbackRouting';

jest.mock('./continueListeningStore', () => ({
  getContinueListening: jest.fn(),
}));
jest.mock('./playbackRouting', () => ({
  playOrOpen: jest.fn().mockResolvedValue(true),
}));

describe('resumeNewestContinue', () => {
  beforeEach(() => jest.mocked(playOrOpen).mockClear());

  it('plays the newest entry from where it stopped', () => {
    jest.mocked(getContinueListening).mockReturnValue([
      {
        reciterId: 'r1',
        rewayahId: '',
        surahNumber: 103,
        positionSeconds: 12,
        durationSeconds: 40,
        updatedAt: 2,
      },
      {
        reciterId: 'r2',
        rewayahId: 'w2',
        surahNumber: 2,
        positionSeconds: 90,
        durationSeconds: 9000,
        updatedAt: 1,
      },
    ]);
    expect(resumeNewestContinue('media-key')).toBe(true);
    expect(playOrOpen).toHaveBeenCalledWith({
      reciterId: 'r1',
      rewayahId: undefined,
      surahNumber: 103,
      startSeconds: 12,
      source: 'media-key',
    });
  });

  it('does nothing when there is nothing to continue', () => {
    jest.mocked(getContinueListening).mockReturnValue([]);
    expect(resumeNewestContinue('media-key')).toBe(false);
    expect(playOrOpen).not.toHaveBeenCalled();
  });
});
