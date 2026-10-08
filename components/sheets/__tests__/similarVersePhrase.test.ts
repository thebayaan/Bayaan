// @ai-generated
// Similar-verse phrase snippets: Hafs shows exactly the text it showed before
// Release 1 (a phrase reaching the verse-end slot keeps its marker); other
// rewayat skip blank slots, keep multi-token slots whole and drop inline
// rewayah markers. The snippet is read from the rewayah asked for (the
// sheet's), never from whatever the mushaf shows. Fixtures use placeholder
// words with real verse markers (U+06DD + Arabic-Indic digits) rather than
// Quran text.
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import {getSimilarPhraseText, joinPhraseWords} from '../similarVersePhrase';

// Words in memory per rewayah; `rewayah` is the mushaf's (the main cache).
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const state = {
    rewayah: 'hafs',
    verses: new Map<string, Map<string, DKWordInfo[]>>(),
  };
  return {
    digitalKhattDataService: {
      get rewayah() {
        return state.rewayah;
      },
      getVerseWords: jest.fn(
        (verseKey: string, rewayah?: string) =>
          state.verses.get(rewayah ?? state.rewayah)?.get(verseKey) ?? [],
      ),
    },
    __state: state,
  };
});

const dk = (
  jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
    __state: {
      rewayah: string;
      verses: Map<string, Map<string, DKWordInfo[]>>;
    };
  }
).__state;

function load(rewayah: string, words: DKWordInfo[]) {
  dk.verses.set(rewayah, new Map([[words[0].verseKey, words]]));
}

const M24 = '۝٢٤'; // end of verse 24
const M3 = '۝٣'; // a rewayah verse end inside the Hafs verse

function slots(verseKey: string, texts: string[]): DKWordInfo[] {
  return texts.map((text, i) => ({
    text,
    verseKey,
    wordPositionInVerse: i + 1,
  }));
}

// The pre-Release 1 snippet code, kept as the reference for Hafs output.
function previousHafsPhrase(
  words: DKWordInfo[],
  wordFrom: number,
  wordTo: number,
): string {
  if (words.length === 0) return '';
  return words
    .filter(
      w => w.wordPositionInVerse >= wordFrom && w.wordPositionInVerse <= wordTo,
    )
    .map(w => w.text)
    .join(' ');
}

// Hafs-shaped verse: one word per slot, the verse number in its own slot.
const HAFS_VERSE = slots('48:24', ['h1', 'h2', 'h3', 'h4', 'h5', M24]);
// The same Hafs slots in a rewayah: a blank slot, a multi-token slot, an
// inline marker where a rewayah verse ends, and the rewayah's own marker in
// the Hafs marker slot.
const REWAYAH_VERSE = slots('48:24', [
  'r1',
  '',
  'r3a r3b',
  `r4 ${M3}`,
  'r5',
  M3,
]);

describe('joinPhraseWords', () => {
  it('keeps the verse marker in a Hafs phrase that reaches the verse end', () => {
    expect(joinPhraseWords(HAFS_VERSE, 4, 6, 'hafs')).toBe(`h4 h5 ${M24}`);
  });

  it('matches the previous Hafs snippet text for every word range', () => {
    for (let from = 0; from <= 7; from++) {
      for (let to = from; to <= 7; to++) {
        expect([
          from,
          to,
          joinPhraseWords(HAFS_VERSE, from, to, 'hafs'),
        ]).toEqual([from, to, previousHafsPhrase(HAFS_VERSE, from, to)]);
      }
    }
    expect(joinPhraseWords([], 1, 3, 'hafs')).toBe('');
  });

  it('shows only words for another rewayah', () => {
    expect(joinPhraseWords(REWAYAH_VERSE, 1, 6, 'warsh')).toBe(
      'r1 r3a r3b r4 r5',
    );
    expect(joinPhraseWords(REWAYAH_VERSE, 2, 2, 'warsh')).toBe('');
    expect(joinPhraseWords(REWAYAH_VERSE, 3, 4, 'qalun')).toBe('r3a r3b r4');
  });
});

describe('getSimilarPhraseText', () => {
  beforeEach(() => {
    dk.verses.clear();
  });

  it('reads Hafs and keeps the Hafs verse marker', () => {
    dk.rewayah = 'hafs';
    load('hafs', HAFS_VERSE);
    expect(getSimilarPhraseText('48:24', 4, 6, 'hafs')).toBe(`h4 h5 ${M24}`);
  });

  it('drops rewayah verse markers in another rewayah', () => {
    dk.rewayah = 'warsh';
    load('warsh', REWAYAH_VERSE);
    expect(getSimilarPhraseText('48:24', 4, 6, 'warsh')).toBe('r4 r5');
  });

  it('reads the rewayah asked for, not the one the mushaf shows', () => {
    dk.rewayah = 'warsh';
    load('warsh', REWAYAH_VERSE);
    load('hafs', HAFS_VERSE);
    expect(getSimilarPhraseText('48:24', 4, 6, 'hafs')).toBe(`h4 h5 ${M24}`);
    dk.rewayah = 'hafs';
    expect(getSimilarPhraseText('48:24', 1, 3, 'warsh')).toBe('r1 r3a r3b');
  });

  it('is empty for a verse with no words loaded', () => {
    dk.rewayah = 'hafs';
    expect(getSimilarPhraseText('2:1', 1, 2, 'hafs')).toBe('');
    load('hafs', HAFS_VERSE);
    expect(getSimilarPhraseText('48:24', 1, 2, 'qalun')).toBe('');
  });
});
