// @ai-generated
/**
 * Last-read is a page and the surah the reader's header named on it.
 * "Continue reading" names that surah; the page alone names the wrong one
 * for every surah that starts on a page shared with the surah before.
 */
import {mushafSessionStore} from '../MushafSessionStore';

describe('mushafSessionStore last-read', () => {
  it('has no surah for a page saved alone (installs from before it was saved)', () => {
    mushafSessionStore.setLastReadPage(440);
    expect(mushafSessionStore.getLastReadPage()).toBe(440);
    expect(mushafSessionStore.getLastReadSurahId()).toBeNull();
  });

  it('returns the surah saved with the page', () => {
    mushafSessionStore.setLastRead(440, 36);
    expect(mushafSessionStore.getLastReadPage()).toBe(440);
    expect(mushafSessionStore.getLastReadSurahId()).toBe(36);
  });

  it('follows the latest save', () => {
    mushafSessionStore.setLastRead(440, 36);
    mushafSessionStore.setLastRead(604, 112);
    expect(mushafSessionStore.getLastReadPage()).toBe(604);
    expect(mushafSessionStore.getLastReadSurahId()).toBe(112);
  });

  it('never pairs a page saved alone with an earlier page surah', () => {
    mushafSessionStore.setLastRead(440, 36);
    mushafSessionStore.setLastReadPage(30);
    expect(mushafSessionStore.getLastReadPage()).toBe(30);
    expect(mushafSessionStore.getLastReadSurahId()).toBeNull();
  });
});
