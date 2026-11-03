// @ai-generated
import {savedVerseOpenParams} from '../openSavedVerse';

describe('savedVerseOpenParams', () => {
  it('a Hafs row: its verse and rewayah, no page, no anchor', () => {
    expect(
      savedVerseOpenParams({
        verseKey: '2:255',
        surahNumber: 2,
        ayahNumber: 255,
        rewayahId: 'hafs',
      }),
    ).toEqual({surah: '2', ayah: '255', rewayah: 'hafs'});
  });

  it('a row of another rewayah: also its anchor', () => {
    expect(
      savedVerseOpenParams({
        verseKey: '1:7:5',
        surahNumber: 1,
        ayahNumber: 7,
        rewayahId: 'warsh',
      }),
    ).toEqual({surah: '1', ayah: '7', anchor: '1:7:5', rewayah: 'warsh'});
  });

  it('a legacy row: no rewayah', () => {
    expect(
      savedVerseOpenParams({verseKey: '3:1', surahNumber: 3, ayahNumber: 1}),
    ).toEqual({surah: '3', ayah: '1'});
  });
});
