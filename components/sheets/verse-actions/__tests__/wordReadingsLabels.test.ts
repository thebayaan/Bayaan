// @ai-generated
/**
 * Labels and notes of the Readings section: narrators clustered under their
 * reader in member order, separators per language, no doubled parentheses,
 * and the notes of real rows of the bundled index (wordReadingsFixture.json).
 */
import i18n from 'i18next';
import {decodeReadingsRow} from '@/services/mushaf/wordReadingsFormat';
import {
  clusterByQari,
  formatNames,
  formatNarrators,
  readingNotes,
} from '../wordReadingsLabels';

interface FixtureWord {
  verseKey: string;
  position: number;
  wordId: number;
  data: string | null;
}
const fixture =
  require('@/services/mushaf/__fixtures__/wordReadingsFixture.json') as {
    words: FixtureWord[];
  };

function readingsAt(verseKey: string, position: number) {
  const w = fixture.words.find(
    x => x.verseKey === verseKey && x.position === position,
  );
  if (!w?.data) throw new Error(`${verseKey}:${position} has no row`);
  return decodeReadingsRow(w.verseKey, w.position, w.wordId, w.data);
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('narrators', () => {
  it('clusters the members under their readers, in member order', () => {
    expect(
      clusterByQari(['hafs', 'shubah', 'al-bazzi', 'warsh', 'qalun']),
    ).toEqual([
      {qari: 'asim', rewayat: ['hafs', 'shubah']},
      {qari: 'ibnKathir', rewayat: ['al-bazzi']},
      {qari: 'nafi', rewayat: ['warsh', 'qalun']},
    ]);
  });

  it('formats them in English and Arabic', async () => {
    expect(formatNarrators(['hafs', 'shubah'])).toBe("Hafs, Shu'bah (Asim)");
    expect(
      formatNarrators([
        'al-bazzi',
        'qunbul',
        'warsh',
        'qalun',
        'al-duri-abi-amr',
        'al-susi',
      ]),
    ).toBe(
      "Al-Bazzi, Qunbul (Ibn Kathir) · Warsh, Qalun (Nafi') · Al-Duri, Al-Susi (Abu Amr)",
    );
    await i18n.changeLanguage('ar');
    expect(formatNarrators(['hafs', 'shubah'])).toBe('حفص، شعبة (عاصم)');
    expect(formatNarrators(['warsh', 'al-duri-abi-amr'])).toBe(
      'ورش (نافع) · الدوري (أبو عمرو)',
    );
  });

  it('never doubles parentheses for al-Duri', async () => {
    const duri = formatNarrators(['al-duri-abi-amr']);
    expect(duri).toBe('Al-Duri (Abu Amr)');
    expect(duri.match(/\(/g)).toHaveLength(1);
    await i18n.changeLanguage('ar');
    expect(formatNarrators(['al-duri-abi-amr']).match(/\(/g)).toHaveLength(1);
  });

  it('lists standalone names with the short labels', async () => {
    expect(formatNames(['warsh', 'al-duri-abi-amr'])).toBe(
      'Warsh, Al-Duri (Abu Amr)',
    );
    await i18n.changeLanguage('ar');
    expect(formatNames(['warsh', 'qalun'])).toBe('ورش، قالون');
  });
});

describe('readingNotes', () => {
  it('1:7:4: Madani and Basri counts end verse 6 here; Ibn Kathir has silah', () => {
    const notes = readingNotes(readingsAt('1:7', 4), [4]);
    expect(notes.verseEnds).toEqual([
      {verse: 6, rewayat: ['warsh', 'qalun', 'al-duri-abi-amr', 'al-susi']},
    ]);
    expect(notes.noVerseEnd).toEqual([]);
    expect(notes.silah).toEqual(['al-bazzi', 'qunbul']);
    expect(notes.span).toBeNull();
  });

  it('2:1:1: only the Kufi count ends a verse after الٓمٓ', () => {
    const notes = readingNotes(readingsAt('2:1', 1), [1]);
    expect(notes.noVerseEnd).toEqual([
      'al-bazzi',
      'qunbul',
      'warsh',
      'qalun',
      'al-duri-abi-amr',
      'al-susi',
    ]);
    expect(notes.verseEnds).toEqual([]);
  });

  it('15:7 is written as one word, 72:16:1 as two', () => {
    expect(readingNotes(readingsAt('15:7', 1), [1]).joined).toEqual([
      'shubah',
      'al-bazzi',
      'qunbul',
      'warsh',
      'qalun',
      'al-duri-abi-amr',
      'al-susi',
    ]);
    expect(readingNotes(readingsAt('72:16', 1), [1]).apart).toEqual([
      'warsh',
      'qalun',
      'al-duri-abi-amr',
      'al-susi',
    ]);
  });

  it("1:1: the basmala note replaces the verse-end note of al-Fatiha's verse 1", () => {
    const notes = readingNotes(readingsAt('1:1', 4), [4]);
    expect(notes.basmalaUnnumbered).toEqual([
      'warsh',
      'qalun',
      'al-duri-abi-amr',
      'al-susi',
    ]);
    expect(notes.noVerseEnd).toEqual([]);
  });

  it('a span is noted from either of its words, not for the word-by-word بَعْدَ مَا', () => {
    expect(readingNotes(readingsAt('40:26', 13), [13]).span).toBe('next');
    expect(readingNotes(readingsAt('40:26', 14), [14]).span).toBe('previous');
    expect(readingNotes(readingsAt('40:26', 13), [13, 14]).span).toBeNull();
  });

  it('notes nothing for a suspected misprint (no UI note)', () => {
    const notes = readingNotes(readingsAt('17:62', 1), [1]);
    expect(notes).toEqual({
      span: null,
      joined: [],
      apart: [],
      verseEnds: [],
      noVerseEnd: [],
      basmalaUnnumbered: [],
      silah: [],
    });
  });
});
