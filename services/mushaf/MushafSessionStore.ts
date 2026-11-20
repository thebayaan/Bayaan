import {createMMKV} from 'react-native-mmkv';

const mmkv = createMMKV({id: 'mushaf-session'});

export const mushafSessionStore = {
  getLastScreenWasMushaf: (): boolean =>
    mmkv.getBoolean('lastScreenWasMushaf') ?? false,
  setLastScreenWasMushaf: (v: boolean): void =>
    mmkv.set('lastScreenWasMushaf', v),
  getLastReadPage: (): number | null => mmkv.getNumber('lastReadPage') ?? null,
  setLastReadPage: (p: number): void => mmkv.set('lastReadPage', p),
  // @ai-start
  /**
   * The surah the reader's header named on the last-read page, or null.
   *
   * A page alone cannot name it: 58 surahs start on a page that also ends
   * the surah before, and a few pages start three. "Continue reading" used
   * to guess from the page and named the previous surah (open Ya-Sin, go
   * back: "Continue reading: Fatir").
   *
   * The surah is saved with the page it was shown on and returned only for
   * that page, so a page saved alone (an install from before this was
   * saved, or `setLastReadPage`) is never paired with another page's surah.
   */
  getLastReadSurahId: (): number | null =>
    mmkv.getNumber('lastReadSurahPage') === mmkv.getNumber('lastReadPage')
      ? mmkv.getNumber('lastReadSurahId') ?? null
      : null,
  /** Saves the last-read page with the surah the reader shows for it. */
  setLastRead: (page: number, surahId: number): void => {
    mmkv.set('lastReadPage', page);
    mmkv.set('lastReadSurahId', surahId);
    mmkv.set('lastReadSurahPage', page);
  },
  // @ai-end
  // @ai-start
  // The Continue Reading line the widgets last showed for a page. A snapshot
  // taken before the Mushaf data loads reads it back.
  getLastOpeningText: (page: number): string =>
    mmkv.getNumber('lastOpeningPage') === page
      ? (mmkv.getString('lastOpeningText') ?? '')
      : '',
  setLastOpeningText: (page: number, text: string): void => {
    mmkv.set('lastOpeningPage', page);
    mmkv.set('lastOpeningText', text);
  },
  // @ai-end
};
