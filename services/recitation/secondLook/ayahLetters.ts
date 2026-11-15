import {ALPHABET} from './judge';

// An ayah's words as quran-asr-small writes them, from the app's own text. This
// is a lookup key for scoring and is never shown as Quran text.
//
// The model writes 29 letters and a word separator: no vowels, and the Uthmani
// spelling. The recipe is the model's own labels: marks, small letters, tatweel
// and digits out, alif forms folded to ا, ى and ئ to ي, ؤ to و, ة to ه.
//
// Compared word by word with the letters of the official KFGQPC file on all
// 6,236 ayat: no differences. ayahLetters.test.ts pins the result.

const FOLD: Readonly<Record<string, string>> = {
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  ٲ: 'ا',
  ٳ: 'ا',
  ى: 'ي',
  ئ: 'ي',
  ے: 'ي',
  ی: 'ي',
  ؤ: 'و',
  ة: 'ه',
  ک: 'ك',
};

// The engine's word numbers equal the text's word order except here, where it
// splits one word in two. No letters for these, so their marks show unchecked.
const ENGINE_SPLITS: ReadonlySet<string> = new Set(['15:7', '27:20', '36:22']);

export function lettersOf(word: string): string {
  let out = '';
  for (const c of word) {
    const folded = FOLD[c] ?? c;
    if (ALPHABET.includes(folded)) out += folded;
  }
  return out;
}

let textByKey: Map<string, string> | null = null;

function ayahText(key: string): string | undefined {
  if (!textByKey) {
    const raw = require('@/data/quran.json') as Record<
      string,
      {verse_key: string; text: string}
    >;
    textByKey = new Map();
    for (const entry of Object.values(raw)) {
      textByKey.set(entry.verse_key, entry.text);
    }
  }
  return textByKey.get(key);
}

/**
 * The letters of each word of an ayah, in the engine's word numbers, or null
 * for an ayah that has none to give. The ayah number and the rub, stop and
 * sajdah signs have no letters, so they are not words here.
 */
export function ayahLetters(surah: number, ayah: number): string[] | null {
  const key = `${surah}:${ayah}`;
  if (ENGINE_SPLITS.has(key)) return null;
  const text = ayahText(key);
  if (!text) return null;
  const words = text.split(/\s+/).map(lettersOf).filter(Boolean);
  return words.length > 0 ? words : null;
}
