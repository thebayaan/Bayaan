// @ai-generated
/**
 * DigitalKhattDataService.getPageForWord on the real Hafs words and layout
 * (read through node:sqlite, Node >= 22.13). In the 15-line layout every
 * page ends at the end of a verse, so each slot is on its verse's page; the
 * method still looks the slot itself up, for layouts where a verse runs on.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-sqlite', () =>
  jest
    .requireActual('@/services/mushaf/__fixtures__/bundledDkSqlite')
    .bundledDkSqliteModule(),
);
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: async () => [],
  getInfoAsync: async () => ({exists: false}),
}));

import {DigitalKhattDataService} from '../DigitalKhattDataService';
import {hasNodeSqlite} from '../__fixtures__/bundledDkSqlite';
import {SURAHS} from '@/data/surahData';

jest.setTimeout(60_000);

const describeWithSqlite = hasNodeSqlite() ? describe : describe.skip;

describeWithSqlite('getPageForWord', () => {
  it('is undefined before the data has loaded', () => {
    expect(new DigitalKhattDataService().getPageForWord('2:282', 1)).toBe(
      undefined,
    );
  });

  it('gives every word the page it is drawn on', async () => {
    const service = new DigitalKhattDataService();
    await service.initialize();
    expect(service.getPageForWord('1:1', 3)).toBe(1);
    expect(service.getPageForWord('2:282', 1)).toBe(48);
    expect(service.getPageForWord('2:282', 128)).toBe(48);
    expect(service.getPageForWord('114:6', 3)).toBe(604);
    let words = 0;
    for (const surah of SURAHS) {
      for (let ayah = 1; ayah <= surah.verses_count; ayah++) {
        const verseKey = `${surah.id}:${ayah}`;
        const page = service.getPageForVerse(verseKey);
        for (const word of service.getVerseWords(verseKey)) {
          expect(
            service.getPageForWord(verseKey, word.wordPositionInVerse),
          ).toBe(page);
          words++;
        }
      }
    }
    // Every slot, the 6,236 verse markers included.
    expect(words).toBe(83_668);
  });

  it('is undefined for a slot the verse does not have', async () => {
    const service = new DigitalKhattDataService();
    await service.initialize();
    expect(service.getPageForWord('1:1', 40)).toBeUndefined();
    expect(service.getPageForWord('115:1', 1)).toBeUndefined();
  });
});
