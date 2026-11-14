// @ai-generated
/**
 * The Arabic letter model of the word-study builds (gharib placement and
 * rasm notes). Build-time only: the app never imports it, and it does not
 * share utils/search (docs/plans/2026-11-14-word-study/README.md, Gharib and
 * rasm: Normalisation), so a change to search folding cannot move a
 * placement or a note.
 *
 * Two kinds of text meet here: the app's Uthmani words (data/wbw/wbw-en.db,
 * Quran.com's encoding, and Digital Khatt's for damaged words) and standard
 * (imla'i) spellings (Tanzil Simple, a gharib book's headwords). The script
 * matters only for آ: in the mushaf ا with ٓ is a long alif with a madd sign
 * and the hamza is always written on its own (ء, أ, ـٔ ...), while in the
 * standard spelling آ is a hamza plus an alif.
 */

export type Script = 'uthmani' | 'imlaei';

const TATWEEL = 'ـ';
const DAGGER_ALIF = 'ٰ';
const MADDA = 'ٓ';
const HAMZA_ABOVE = 'ٔ';
const HAMZA_BELOW = 'ٕ';
/** ۟ and ۠: the letter is written but not read. */
const ZAID_SIGNS = new Set(['۟', '۠']);
/**
 * ۜ above ص: read as س (يَبْصُۜطُ; the standard spelling writes س). The small
 * seen below ص (ٱلْمُصَۣيْطِرُونَ) keeps ص as the main reading and the
 * standard spelling keeps ص, so it is not a badal sign.
 */
const SEEN_SIGNS = new Set(['ۜ']);
/** The mushaf's small letters: ۥ waw, ۦ ya, ۧ high ya, ۨ high nun. */
const SMALL_LETTERS: Readonly<Record<string, string>> = {
  ۥ: 'و',
  ۦ: 'ي',
  'ۧ': 'ي',
  'ۨ': 'ن',
};

/** Arabic base letters (U+0621–U+064A and alif wasla). */
export function isArabicLetter(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (
    (c >= 0x0621 && c <= 0x063a) || (c >= 0x0641 && c <= 0x064a) || c === 0x0671
  );
}

/**
 * Marks with no letter value: harakat, Quranic annotation and pause signs,
 * the DK open tanween, invisible format characters. The small letters, ٰ,
 * ۟/۠ and the hamza marks are in this set too; rasmLetters reads them first.
 */
function isMark(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (
    (c >= 0x0610 && c <= 0x061a) ||
    (c >= 0x064b && c <= 0x065f) ||
    c === 0x0670 ||
    (c >= 0x06d6 && c <= 0x06ed) ||
    (c >= 0x08d3 && c <= 0x08ff) ||
    c === 0x0640 ||
    c === 0x200c ||
    c === 0x200d ||
    c === 0x200e ||
    c === 0x200f ||
    c === 0xfeff
  );
}

/**
 * Restores the long vowels and small letters the mushaf writes small, so an
 * Uthmani word reads like its standard spelling:
 *  - ٰ directly on و (no vowel of its own) turns the و into ا (ٱلصَّلَوٰةَ →
 *    الصلاة); on ى inside a word turns the ى into ا (فَسَوَّىٰهُنَّ); on a
 *    word-final ى it is dropped (عَلَىٰ); anywhere else, also on tatweel, it is
 *    an ا (مَـٰلِكِ → مالك);
 *  - the small letters ۥ ۦ ۧ ۨ become و ي ي ن (إِبْرَٰهِـۧمَ → إبراهيم), except
 *    on ه, where they mark the lengthened pronoun (إِنَّهُۥ) and are dropped.
 * Everything else is kept; the matching keys strip it.
 */
export function plene(uthmani: string): string {
  const chars = [...uthmani];
  const out: string[] = [];
  // Index in `out` of the last base letter or tatweel, and whether a vowel
  // followed it.
  let carrier = -1;
  let carrierChar = '';
  let vowelSinceCarrier = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (isArabicLetter(ch) || ch === TATWEEL) {
      out.push(ch);
      carrier = out.length - 1;
      carrierChar = ch;
      vowelSinceCarrier = false;
      continue;
    }
    if (ch === DAGGER_ALIF) {
      if (carrier >= 0 && !vowelSinceCarrier && carrierChar === 'و') {
        out[carrier] = 'ا';
      } else if (carrier >= 0 && !vowelSinceCarrier && carrierChar === 'ى') {
        if (!wordEndsAfter(chars, i)) out[carrier] = 'ا';
      } else if (carrier >= 0 && carrierChar === TATWEEL) {
        out[carrier] = 'ا';
      } else {
        out.push('ا');
      }
      continue;
    }
    const small = SMALL_LETTERS[ch];
    if (small) {
      if (carrierChar !== 'ه') out.push(small);
      continue;
    }
    if (/\s/.test(ch)) {
      carrier = -1;
      carrierChar = '';
    } else if (isMark(ch)) {
      vowelSinceCarrier = true;
    }
    out.push(ch);
  }
  return out.join('');
}

/** True when no base letter follows index `i` before the next space. */
function wordEndsAfter(chars: readonly string[], i: number): boolean {
  for (let j = i + 1; j < chars.length; j++) {
    if (/\s/.test(chars[j])) return true;
    if (isArabicLetter(chars[j])) return false;
  }
  return true;
}

/**
 * Letters only, folded for matching: no marks or small signs, every alif form
 * is ا, ى is ي, ة is ه, ؤ is و, ئ is ي, and ء is dropped. Words stay apart
 * (one space); anything that is not an Arabic letter separates words.
 */
export function searchKey(text: string): string {
  let out = '';
  for (const ch of text) {
    if (isMark(ch)) continue;
    if (!isArabicLetter(ch)) {
      out += ' ';
      continue;
    }
    switch (ch) {
      case 'أ':
      case 'إ':
      case 'آ':
      case 'ٱ':
        out += 'ا';
        break;
      case 'ى':
        out += 'ي';
        break;
      case 'ة':
        out += 'ه';
        break;
      case 'ؤ':
        out += 'و';
        break;
      case 'ئ':
        out += 'ي';
        break;
      case 'ء':
        break;
      default:
        out += ch;
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Tier-1 key: the plene form folded, spaces removed. */
export function matchKey(text: string): string {
  return searchKey(plene(text)).replace(/ /g, '');
}

/** Tier-1 key without plene, so ذَٰلِكَ = ذلك and ٱلرَّحْمَـٰنِ = الرحمن. */
export function plainKey(text: string): string {
  return searchKey(text).replace(/ /g, '');
}

/** Tier-2 key: a tier-1 key with every ا removed (ٱلْكِتَـٰبُ = الكتاب). */
export function alifFreeKey(key: string): string {
  return key.replace(/ا/g, '');
}

/**
 * The loosest skeleton: no ا و ي ى, no hamza or seat, each word's final
 * ة/ت/ه folded together, ن before ل or م dropped (it merges into them when
 * the words are written joined: أَن لَّا = أَلَّا, عَن مَّا = عَمَّا), doubled
 * letters merged, spaces removed. The mushaf's own reading signs count: ص
 * with a small seen is س, and the small ۨ is ن. Used to pair the mushaf's
 * words with a standard text and for tier-4 gharib placement.
 */
export function looseKey(text: string): string {
  const chars = [...text];
  let read = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === 'ص' && seenSignFollows(chars, i)) read += 'س';
    else if (ch === 'ۨ') read += 'ن';
    else read += ch;
  }
  const words = searchKey(read)
    .split(' ')
    .filter(Boolean)
    .map(w => w.replace(/[تة]$/, 'ه').replace(/[اويى]/g, ''));
  return words
    .join('')
    .replace(/ن(?=[لم])/g, '')
    .replace(/(.)\1+/g, '$1');
}

/** A small seen sits on the letter at `i` (before the next base letter). */
function seenSignFollows(chars: readonly string[], i: number): boolean {
  for (let j = i + 1; j < chars.length; j++) {
    if (SEEN_SIGNS.has(chars[j])) return true;
    if (isArabicLetter(chars[j]) || chars[j] === TATWEEL || /\s/.test(chars[j]))
      return false;
  }
  return false;
}

/** Attached prefixes, longest first (in searchKey letters). */
export const PROCLITICS: readonly string[] = [
  'وال',
  'فال',
  'بال',
  'كال',
  'لل',
  'ال',
  'و',
  'ف',
  'ب',
  'ل',
  'ك',
  'س',
];

/** Attached pronouns, longest first (in searchKey letters). */
export const ENCLITICS: readonly string[] = [
  'هما',
  'كما',
  'هم',
  'هن',
  'ها',
  'كم',
  'كن',
  'نا',
  'ني',
  'ه',
  'ك',
  'ي',
];

// ---------------------------------------------------------------------------
// Letter model for rasm comparison.

/** The mushaf's sign of a badal on this letter. */
export type RasmHint = 'wawAlif' | 'yaAlif' | 'seen';

export interface RasmLetter {
  /**
   * The letter compared: ا for every alif form, و for ؤ, ي for ي ى ئ (the
   * rasm has no dots); every other letter as written.
   */
  base: string;
  /** The letter as written (أ, ى, ئ, ة ...), for display. */
  raw: string;
  /** UTF-16 range [start, end) of the letter and its marks in the input. */
  start: number;
  end: number;
  /** A hamza sits on this letter: أ إ ؤ ئ, and آ in the standard spelling. */
  hamza: boolean;
  /** Written but not read: the letter carries ۟ or ۠. */
  zaid: boolean;
  /**
   * wawAlif: ٰ directly on و (alif written as waw); yaAlif: ٰ on ى inside a
   * word (alif written as ya); seen: a small seen on ص (read as س).
   */
  hint: RasmHint | null;
  /** Index of the written word (space-separated) holding the letter. */
  word: number;
}

/** A sign between two letters that stands for a letter of its own. */
export interface RasmGapItem {
  /**
   * small: ٰ (ا) or the small letters ۥ ۦ ۧ ۨ (و ي ي ن), not counting ṣila
   * on ه; hamza: a hamza with no seat (ء, or ٔ on tatweel), shown as ء.
   */
  kind: 'small' | 'hamza';
  letter: string;
  start: number;
  end: number;
  /** Index of the written word (space-separated) holding the sign. */
  word: number;
}

export interface RasmWord {
  letters: RasmLetter[];
  /** gaps[i] holds the signs between letters[i - 1] and letters[i]. */
  gaps: RasmGapItem[][];
  /** Number of written words (letter-bearing, space-separated). */
  words: number;
}

const SEAT_OF: Readonly<Record<string, {base: string; hamza: boolean}>> = {
  ا: {base: 'ا', hamza: false},
  ٱ: {base: 'ا', hamza: false},
  أ: {base: 'ا', hamza: true},
  إ: {base: 'ا', hamza: true},
  ؤ: {base: 'و', hamza: true},
  ئ: {base: 'ي', hamza: true},
  ى: {base: 'ي', hamza: false},
  ي: {base: 'ي', hamza: false},
};

/**
 * Reads a word (or several, space-separated) as rasm letters and the signs
 * between them, following the sign table of the design (04-gharib-rasm.md
 * §2.2). Harakat, pause signs, ۞, ۩ and dots are ignored. Offsets refer to
 * the input as given (no normalisation), so a mark can be drawn on it.
 */
export function rasmLetters(
  text: string,
  script: Script = 'uthmani',
): RasmWord {
  const letters: RasmLetter[] = [];
  const gaps: RasmGapItem[][] = [[]];
  let word = 0;
  let wordHasLetters = false;
  let words = 0;
  // What the next marks sit on: the last letter, a tatweel, or a hamza with
  // no seat (its harakat belong to it).
  let onLetter: RasmLetter | null = null;
  let onTatweel = false;
  let onHamza: RasmGapItem | null = null;
  let vowelSince = false;
  const gapItem = (item: Omit<RasmGapItem, 'word'>): RasmGapItem => {
    const full = {...item, word};
    gaps[letters.length].push(full);
    return full;
  };
  const attach = (i: number) => {
    if (onLetter) onLetter.end = i + 1;
    else if (onHamza) onHamza.end = i + 1;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (wordHasLetters) word++;
      wordHasLetters = false;
      onLetter = null;
      onTatweel = false;
      onHamza = null;
      continue;
    }
    if (ch === 'ء') {
      onHamza = gapItem({kind: 'hamza', letter: 'ء', start: i, end: i + 1});
      onLetter = null;
      onTatweel = false;
      continue;
    }
    if (isArabicLetter(ch)) {
      if (!wordHasLetters) words++;
      wordHasLetters = true;
      const seat = SEAT_OF[ch];
      const letter: RasmLetter = {
        base: seat ? seat.base : ch === 'آ' ? 'ا' : ch,
        raw: ch,
        start: i,
        end: i + 1,
        hamza: seat ? seat.hamza : ch === 'آ' && script === 'imlaei',
        zaid: false,
        hint: null,
        word,
      };
      letters.push(letter);
      gaps.push([]);
      onLetter = letter;
      onTatweel = false;
      onHamza = null;
      vowelSince = false;
      continue;
    }
    if (ch === TATWEEL) {
      onLetter = null;
      onTatweel = true;
      onHamza = null;
      continue;
    }
    // A mark on the last letter, a tatweel or a seatless hamza.
    if (ch === DAGGER_ALIF) {
      // Directly on a letter: no vowel between the letter and the ٰ.
      const direct = vowelSince ? null : onLetter;
      if (direct?.raw === 'و' && script === 'uthmani') {
        direct.hint = 'wawAlif';
        attach(i);
      } else if (direct?.raw === 'ى') {
        // ىٰ at the end of a word is the standard spelling too (عَلَىٰ).
        if (letterFollowsInWord(text, i)) {
          if (script === 'uthmani') direct.hint = 'yaAlif';
          else gapItem({kind: 'small', letter: 'ا', start: i, end: i + 1});
        }
        attach(i);
      } else {
        gapItem({kind: 'small', letter: 'ا', start: i, end: i + 1});
      }
      continue;
    }
    if (ch === HAMZA_ABOVE || ch === HAMZA_BELOW) {
      // Only ا, و and ي can seat a hamza. On any other letter it follows a
      // ٰ (فَٱدَّٰرَْٰٔتُمْ) and has no seat.
      if (onTatweel || !onLetter || !'اوي'.includes(onLetter.base)) {
        onHamza = gapItem({kind: 'hamza', letter: 'ء', start: i, end: i + 1});
        onTatweel = false;
      } else {
        onLetter.hamza = true;
        onLetter.raw = composeSeat(onLetter.raw, ch);
        attach(i);
      }
      continue;
    }
    if (ch === MADDA) {
      // آ written as ا + ٓ: a hamza only in the standard spelling.
      if (onLetter && onLetter.base === 'ا' && script === 'imlaei') {
        onLetter.hamza = true;
        onLetter.raw = 'آ';
      }
      attach(i);
      continue;
    }
    const small = SMALL_LETTERS[ch];
    if (small) {
      // On ه itself they lengthen the pronoun (ṣila) and stand for nothing.
      if (onLetter && onLetter.raw === 'ه') attach(i);
      else gapItem({kind: 'small', letter: small, start: i, end: i + 1});
      continue;
    }
    if (ZAID_SIGNS.has(ch)) {
      if (onLetter) onLetter.zaid = true;
      attach(i);
      continue;
    }
    if (SEEN_SIGNS.has(ch)) {
      if (onLetter && onLetter.raw === 'ص') onLetter.hint = 'seen';
      attach(i);
      continue;
    }
    if (isMark(ch)) {
      const c = ch.charCodeAt(0);
      if (c >= 0x064b && c <= 0x0652) vowelSince = true;
      attach(i);
    }
    // Anything else (digits, punctuation): ignored.
  }
  return {letters, gaps, words};
}

/** The precomposed form of a seat with a hamza mark (ا + ٔ = أ ...). */
function composeSeat(raw: string, hamza: string): string {
  if (raw === 'ا') return hamza === HAMZA_BELOW ? 'إ' : 'أ';
  if (raw === 'و') return 'ؤ';
  if (raw === 'ي' || raw === 'ى') return 'ئ';
  return raw;
}

/** True when a base letter follows index `i` before the next space. */
function letterFollowsInWord(text: string, i: number): boolean {
  for (let j = i + 1; j < text.length; j++) {
    if (/\s/.test(text[j])) return false;
    if (isArabicLetter(text[j]) && text[j] !== 'ء') return true;
  }
  return false;
}
