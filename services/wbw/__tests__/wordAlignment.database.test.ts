// @ai-generated
/**
 * The word pairing over the bundled data: every verse of the Hafs
 * DigitalKhatt words (data/mushaf/digitalkhatt/digital-khatt-v2.db) paired
 * with its word-by-word words (data/wbw/wbw-en.db), as every word-by-word
 * grid pairs them (WBWVerseView). A data update that shifts the words of a
 * verse fails here.
 */
import path from 'path';
import Database from 'better-sqlite3';
import {
  alignDkWithWbw,
  isVerseEndMarker,
  normalizeForMatch,
  slotsByWbwPosition,
  type DkWbwAlignment,
} from '../wordAlignment';

const REPO = path.join(__dirname, '../../..');
const DK_DB = path.join(REPO, 'data/mushaf/digitalkhatt/digital-khatt-v2.db');
const WBW_DB = path.join(REPO, 'data/wbw/wbw-en.db');

interface Slot {
  text: string;
  wordPositionInVerse: number;
}
interface Word {
  position: number;
  textUthmani: string;
}
interface Verse {
  key: string;
  dk: Slot[];
  wbw: Word[];
  alignment: DkWbwAlignment<Slot, Word>;
}

/** The verses where DigitalKhatt writes بَعْدَ مَا as two slots: word -> slots. */
const TWO_SLOT_WORDS: Record<string, [number, number[]]> = {
  '2:181': [3, [3, 4]],
  '8:6': [4, [4, 5]],
  '13:37': [8, [8, 9]],
};

/**
 * Word-by-word words spelled differently from the mushaf (checked by hand):
 * the text check below skips them.
 */
const SPELLED_DIFFERENTLY: Record<string, string> = {
  // افْتَرَاهُ with alef; the mushaf writes ٱفْتَرَىٰهُ (ى with a dagger alef).
  '11:13:3': 'افْتَرَاهُ ۖ',
};

const verses: Verse[] = [];

beforeAll(() => {
  const dkDb = new Database(DK_DB, {readonly: true});
  const wbwDb = new Database(WBW_DB, {readonly: true});
  const byKey = new Map<string, {dk: Slot[]; wbw: Word[]}>();
  const entry = (key: string) => {
    let found = byKey.get(key);
    if (!found) {
      found = {dk: [], wbw: []};
      byKey.set(key, found);
    }
    return found;
  };
  try {
    const slots = dkDb
      .prepare('SELECT surah, ayah, word, text FROM words ORDER BY id')
      .all() as {surah: number; ayah: number; word: number; text: string}[];
    for (const r of slots) {
      entry(`${r.surah}:${r.ayah}`).dk.push({
        text: r.text,
        wordPositionInVerse: r.word,
      });
    }
    const words = wbwDb
      .prepare(
        'SELECT verse_key, position, text_uthmani FROM words ORDER BY verse_key, position',
      )
      .all() as {verse_key: string; position: number; text_uthmani: string}[];
    for (const r of words) {
      entry(r.verse_key).wbw.push({
        position: r.position,
        // As WBWDataService reads it.
        textUthmani: r.text_uthmani || '',
      });
    }
  } finally {
    dkDb.close();
    wbwDb.close();
  }
  for (const [key, {dk, wbw}] of byKey) {
    verses.push({key, dk, wbw, alignment: alignDkWithWbw(dk, wbw)});
  }
});

/**
 * A word's letters as both sources spell them alike: normalized, hamza
 * carriers and alef maksura folded, the grapheme joiner (U+034F) and spaces
 * out.
 */
function letters(text: string): string {
  return normalizeForMatch(text.replace(/\u034F/g, ''))
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ /g, '');
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
  }
  return i === needle.length;
}

const verse = (key: string): Verse => {
  const found = verses.find(v => v.key === key);
  if (!found) throw new Error(`no verse ${key}`);
  return found;
};

describe('the pairing of every verse', () => {
  it('covers the 6,236 verses of both databases', () => {
    expect(verses).toHaveLength(6236);
    expect(
      verses.filter(v => v.dk.length < 2 || v.wbw.length === 0).map(v => v.key),
    ).toEqual([]);
  });

  it("takes every verse's last slot out as its end marker, never paired", () => {
    const bad = verses.filter(v => {
      const last = v.dk[v.dk.length - 1];
      return (
        v.alignment.endMarker !== last ||
        !isVerseEndMarker(last.text) ||
        v.alignment.pairs.length !== v.dk.length - 1 ||
        v.alignment.pairs.some(p => isVerseEndMarker(p.dk.text))
      );
    });
    expect(bad.map(v => v.key)).toEqual([]);
  });

  it('pairs every word-by-word word at least once, in order', () => {
    const bad = verses.filter(v => {
      const positions = v.alignment.pairs.map(p => p.wbw.position);
      if (positions[0] !== 1) return true;
      if (new Set(positions).size !== v.wbw.length) return true;
      for (let i = 1; i < positions.length; i++) {
        const step = positions[i] - positions[i - 1];
        if (step !== 0 && step !== 1) return true;
      }
      return false;
    });
    expect(bad.map(v => v.key)).toEqual([]);
  });

  it('keeps slot and word-by-word positions equal except in 2:181, 8:6 and 13:37', () => {
    const differing = verses
      .filter(v =>
        v.alignment.pairs.some(
          p => p.dk.wordPositionInVerse !== p.wbw.position,
        ),
      )
      .map(v => v.key);
    expect(differing.sort()).toEqual(Object.keys(TWO_SLOT_WORDS).sort());
  });

  it('writes only بَعْدَ مَا as two slots', () => {
    const twoSlotWords: Record<string, [number, number[]]> = {};
    for (const v of verses) {
      for (const [position, slots] of slotsByWbwPosition(v.alignment.pairs)) {
        if (slots.length > 1) {
          expect(twoSlotWords[v.key]).toBeUndefined();
          twoSlotWords[v.key] = [position, slots];
        }
      }
    }
    expect(twoSlotWords).toEqual(TWO_SLOT_WORDS);
    for (const key of Object.keys(TWO_SLOT_WORDS)) {
      const [position, slots] = TWO_SLOT_WORDS[key];
      const v = verse(key);
      expect(slots.map(s => normalizeForMatch(v.dk[s - 1].text))).toEqual([
        'بعد',
        'ما',
      ]);
      expect(normalizeForMatch(v.wbw[position - 1].textUthmani)).toBe('بعد ما');
    }
  });

  it('pairs each word with the slots that spell it', () => {
    const mismatched: string[] = [];
    for (const v of verses) {
      const slots = slotsByWbwPosition(v.alignment.pairs);
      for (const word of v.wbw) {
        const ref = `${v.key}:${word.position}`;
        if (SPELLED_DIFFERENTLY[ref] === word.textUthmani) continue;
        const dkLetters = (slots.get(word.position) ?? [])
          .map(s => letters(v.dk[s - 1].text))
          .join('');
        const wbwLetters = letters(word.textUthmani);
        // A damaged word (U+FFFD) lost the letters the U+FFFD replaced.
        const ok = word.textUthmani.includes('\uFFFD')
          ? wbwLetters.length > 0 && isSubsequence(wbwLetters, dkLetters)
          : wbwLetters === dkLetters;
        if (!ok) mismatched.push(`${ref} ${dkLetters} / ${wbwLetters}`);
      }
    }
    expect(mismatched).toEqual([]);
  });
});

describe('the verses the text matching used to mispair', () => {
  it('25:42 pairs 1:1 despite the U+FFFD in word 9', () => {
    const v = verse('25:42');
    expect(v.wbw[8].textUthmani).toContain('\uFFFD');
    expect(
      v.alignment.pairs.map(p => [p.dk.wordPositionInVerse, p.wbw.position]),
    ).toEqual(Array.from({length: 17}, (_, i) => [i + 1, i + 1]));
    expect(v.alignment.endMarker?.wordPositionInVerse).toBe(18);
  });

  it('27:26 pairs 1:1 despite the ۩ and U+200F in word 8', () => {
    const v = verse('27:26');
    expect(v.wbw[7].textUthmani.endsWith('۩\u200F')).toBe(true);
    expect(
      v.alignment.pairs.map(p => [p.dk.wordPositionInVerse, p.wbw.position]),
    ).toEqual(Array.from({length: 8}, (_, i) => [i + 1, i + 1]));
    expect(v.alignment.endMarker?.wordPositionInVerse).toBe(9);
  });
});
