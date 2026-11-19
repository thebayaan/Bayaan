// @ai-generated
/**
 * Search spellings of Quran words and of typed queries, for the Quran text
 * search (docs/features/quran-search.md).
 *
 * The index side reads the Hafs Digital Khatt words. Their Uthmani spelling
 * often differs from everyday (imla'i) writing: a dagger alif for alif
 * (ٱلرَّحْمَٰنِ), waw for alif (ٱلصَّلَوٰةَ), a small yeh (إِبْرَٰهِـۧمَ), hamza
 * without a seat. Every word therefore gets the spellings a reader may type,
 * all built by rule from its own letters:
 * - imlaei: the dagger alif and the waw-alif written as alif, the small yeh
 *   as yeh;
 * - alternates: everyday spellings of conventions that depend on the word
 *   (يدعو, رأى), and a hamza drawn on the line or on a tatweel written on
 *   its everyday seat (يَسْـَٔلُونَكَ → يسألونك);
 * - rasm: the letters as drawn, without the small letters;
 * - mixed: for words with two or three dagger alifs, the other combinations.
 * Each spelling is then folded like the catalogue keys (normalize.ts): marks
 * removed, ٱ أ إ آ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي, ء dropped.
 *
 * The query side applies the same folds, so a typed or pasted word gives the
 * key of one of those spellings.
 */
import {ARABIC_MARKS, foldArabicLetters, foldHamzaCarriers} from './normalize';

/** Bump when a spelling rule changes: the search index must be rebuilt. */
export const QURAN_TEXT_NORMALIZER_VERSION = 3;

/** Queries are cut to this many words, and this many letters (not marks). */
export const QURAN_QUERY_MAX_TOKENS = 24;
export const QURAN_QUERY_MAX_LENGTH = 200;
/** Characters of input read at all (pasted text with its marks). */
const QURAN_QUERY_INPUT_LIMIT = 2000;

// In Uthmani text the maddah is a madd sign, never a hamza: it goes before
// NFC, which would otherwise turn ا + maddah into آ (مَآءً, فَلَآ).
const MADDAH = /\u{0653}/gu;
// An end-of-ayah sign with its number (a pasted verse, or a slot of a words
// DB that ends an ayah).
const VERSE_END = /\u{06DD}[\u{0660}-\u{0669}\u{06F0}-\u{06F9}0-9]*/gu;
// Ornate parentheses around a verse number, once its digits are ASCII.
const ORNATE_VERSE_NUMBER =
  /[\u{FD3E}\u{FD3F}]\s*[0-9]+\s*[\u{FD3E}\u{FD3F}]/gu;
// Rub el hizb, sajdah sign, combining grapheme joiner.
const DECORATIONS = /[\u{06DE}\u{06E9}]|\u{034F}/gu;
// ىٰ ending a word is a written alif maqsura (عَلَىٰ): its dagger alif is not
// another alif. Inside a word, before a suffix, everyday writing turns it
// into alif (هَدَىٰهُمْ → هداهم, ٱلتَّوْرَىٰةَ → التوراة).
const FINAL_MAQSURA_DAGGER =
  /\u{0649}([\u{064B}-\u{0652}]*)\u{0670}(?=\p{M}*(?:[^\p{L}\p{M}]|$))/gu;
const MEDIAL_MAQSURA_DAGGER = /\u{0649}([\u{064B}-\u{0652}]*)\u{0670}/gu;
// The vocative يا is always written with an alif (يَٰقَوْمِ, يَٰٓأَيُّهَا).
const VOCATIVE = /^\u{064A}([\u{064B}-\u{0652}]*)\u{0670}/u;
// ٱلَّيْل (al-layl) and ٱلَّٰتِى / ٱلَّٰٓـِٔى (al-lati, al-la'i) are drawn with
// one lam; everyday writing has two (الليل, اللاتي, اللائي).
const LAYL =
  /\u{0671}\u{0644}([\u{064B}-\u{0652}]*\u{0651}[\u{064B}-\u{0652}]*)\u{064A}([\u{064B}-\u{0652}]*)\u{0644}/gu;
const LAM_DAGGER =
  /\u{0671}\u{0644}([\u{064B}-\u{0652}]*\u{0651}[\u{064B}-\u{0652}]*\u{0670})/gu;
// So is the dual relative ٱلَّذَانِ / ٱلَّذَيْنِ (اللذان, اللذين); the singular and
// plural keep one lam everywhere (ٱلَّذِى, ٱلَّذِينَ → الذي, الذين).
const DUAL_RELATIVE =
  /\u{0671}\u{0644}([\u{064B}-\u{0652}]*\u{0651}[\u{064B}-\u{0652}]*)\u{0630}\u{064E}/gu;
// A bare waw before a dagger alif is read as alif (ٱلصَّلَوٰةَ, ٱلرِّبَوٰا۟).
const WAW_ALIF = /\u{0648}\u{0670}(?:\u{0627}\u{06DF})?/gu;
const DAGGER_ALIF = /\u{0670}/gu;
const SMALL_HIGH_YEH = /\u{06E7}/gu;
// A small waw or yeh after the pronoun ه only lengthens its vowel (بِهِۦ,
// لَهُۥ); after any other letter it is a letter everyday writing spells out
// (يُحْيِۦ → يحيي, دَاوُۥدَ → داوود, يَسْتَوُۥنَ → يستوون).
const SMALL_WAW_YEH = /(\u{0647}\p{M}*)?([\u{06E5}\u{06E6}])/gu;
// The small high noon is a noon (نُـۨجِى → ننجي).
const SMALL_HIGH_NOON = /\u{06E8}/gu;
// A yeh marked silent is not written (أَفَإِي۟ن → أفإن, بِأَيْي۟دٍ → بأيد).
const SILENT_YEH = /\u{064A}\u{06DF}/gu;
// Conventions where everyday writing differs from the drawn letters in a way
// that depends on the word, so both spellings are kept (see imlaeiAlternates).
const FINAL_SILENT_ALIF = /\u{0627}\u{06DF}(\p{M}*)$/u;
const MEDIAL_SILENT_ALIF = /\u{0627}\u{06DF}(?=\p{M}*\p{L})/gu;
const FINAL_WAW_HAMZA = /\u{0624}(\p{M}*)\u{0627}\u{06DF}(\p{M}*)$/u;
const FINAL_HAMZA_ALIF =
  /(\u{0621}\u{064E}|\u{064E}\u{0654}|\u{0654}\u{064E})\u{0627}(\p{M}*)$/u;
const FINAL_HAMZA_WAW = /((?:\u{0621}|\u{0654})\p{M}*\u{0648})(\p{M}*)$/u;
// A final hamza drawn on a seat after a long alif or waw (وَإِيتَآئِ, تَبُوٓأَ):
// everyday spelling puts it on the line (إيتاء, تبوء).
const FINAL_SEATED_HAMZA_AFTER_MADD =
  /([\u{0627}\u{0648}])[\u{0623}\u{0626}](\p{M}*)$/u; // @ai
const SAAL_IMPERATIVE =
  /^([\u{0641}\u{0648}]\p{M}*)(\u{0633}\u{0652}\u{0640})/u;
// A sad with a small seen over or under it is read, and written everyday,
// as a seen (يَبْصُۜطُ → يبسط, بَصْۜطَةً → بسطة, ٱلْمُصَۣيْطِرُونَ).
const SAD_WITH_SMALL_SEEN = /\u{0635}(\p{M}*[\u{06DC}\u{06E3}])/gu;
// A silent waw is not written, except in أُو۟لَٰٓئِكَ, أُو۟لُوا۟ and their
// kin, where it comes before a lam (سَأُو۟رِيكُمْ → سأريكم).
const SILENT_WAW = /\u{0648}\u{06DF}(?!\p{M}*\u{0644})/gu;
// A hamza on an alif followed by a silent yeh and the pronoun is a hamza on
// a yeh in everyday writing (وَمَلَإِي۟هِۦ → وملئه); before other letters
// the yeh just goes (أَفَإِي۟ن → أفإن).
const HAMZA_BEFORE_SILENT_YEH =
  /\u{0625}(\p{M}*)\u{064A}\u{06DF}(?=\p{M}*\u{0647})/u;
const HAMZA = /[\u{0621}-\u{0626}]|[\u{0654}-\u{0655}]/u;
const MARK = /\p{M}/u;
// With the Persian, Urdu and Kurdish letters foldArabicLetters reads as
// Arabic ones (ک ی ہ ھ ە ۀ ۂ ۃ ے ې).
const ARABIC_LETTER =
  /[\u{0621}-\u{063A}\u{0641}-\u{064A}\u{0671}\u{06A9}\u{06BE}\u{06C0}-\u{06C3}\u{06CC}\u{06D0}\u{06D2}\u{06D5}]/u;
const BIDI_AND_ZERO_WIDTH =
  /[\u{200B}-\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{FEFF}]/gu;
const ROOT_PREFIX = /^\s*(root|جذر)\s*[:：]\s*/iu;

/** Every folded spelling uses only these letters (ا-غ and ف-ي, without ة ى). */
const FOLDED_FORM =
  /^[\u{0627}\u{0628}\u{062A}-\u{063A}\u{0641}-\u{0648}\u{064A}]+$/u;

/** True when `form` is a non-empty folded spelling. */
export function isFoldedForm(form: string): boolean {
  return FOLDED_FORM.test(form);
}

/** True for a Digital Khatt verse-marker slot (۝١). */
export function isVerseMarker(slotText: string): boolean {
  return slotText.startsWith('\u{06DD}');
}

/** Maddah removed, NFC, decorations removed, final ىٰ → ى. */
function prepareDrawn(text: string): string {
  return text
    .replace(MADDAH, '')
    .normalize('NFC')
    .replace(VERSE_END, ' ')
    .replace(DECORATIONS, '')
    .replace(FINAL_MAQSURA_DAGGER, '\u{0649}$1');
}

/** prepareDrawn, and the one-lam words written with two. */
function prepare(text: string): string {
  return prepareDrawn(text)
    .replace(LAYL, '\u{0671}\u{0644}\u{0644}$1\u{064A}$2\u{0644}')
    .replace(LAM_DAGGER, '\u{0671}\u{0644}\u{0644}$1')
    .replace(DUAL_RELATIVE, '\u{0671}\u{0644}\u{0644}$1\u{0630}\u{064E}');
}

/**
 * Everyday spellings of Uthmani conventions that depend on the word, kept
 * beside the main imla'i spelling:
 * - a silent final alif: a plural verb keeps it (قَالُوا۟ → قالوا), other
 *   words drop it (يَدْعُوا۟ → يدعو, أُو۟لُوا۟ → أولو, ثَمُودَا۟ → ثمود);
 * - a silent alif inside a word is dropped (مِا۟ئَةَ → مئة, لَأَا۟ذْبَحَنَّهُۥ);
 * - a final hamza on waw with a silent alif is a hamza on alif or on the
 *   line (يَبْدَؤُا۟ → يبدأ, جَزَٰٓؤُا۟ → جزاء);
 * - a final hamza and alif is a hamza and alif maqsura (رَءَا → رأى);
 * - a plural waw after a hamza gets its alif (جَآءُو → جاءوا);
 * - the imperative of سأل after ف or و gets its alif (فَسْـَٔلْ → فاسأل);
 * - a sad with a small seen is a seen (يَبْصُۜطُ → يبسط);
 * - a silent waw is dropped, except before a lam (سَأُو۟رِيكُمْ → سأريكم).
 */
function imlaeiAlternates(base: string): string[] {
  const out: string[] = [];
  const push = (alternate: string) => {
    if (alternate !== base) out.push(alternate);
  };
  if (FINAL_WAW_HAMZA.test(base)) {
    push(base.replace(FINAL_WAW_HAMZA, '\u{0623}$1$2'));
    push(base.replace(FINAL_WAW_HAMZA, '\u{0621}$1$2'));
  } else {
    push(base.replace(FINAL_SILENT_ALIF, '$1'));
  }
  push(base.replace(MEDIAL_SILENT_ALIF, ''));
  push(base.replace(FINAL_HAMZA_ALIF, '$1\u{0649}$2'));
  push(base.replace(FINAL_HAMZA_WAW, '$1\u{0627}$2'));
  push(base.replace(SAAL_IMPERATIVE, '$1\u{0627}$2'));
  push(base.replace(FINAL_SEATED_HAMZA_AFTER_MADD, '$1\u{0621}$2')); // @ai
  push(base.replace(SAD_WITH_SMALL_SEEN, '\u{0633}$1'));
  push(base.replace(SILENT_WAW, ''));
  return out;
}

// ── Hamza seats ────────────────────────────────────────────────────────────

type Vowel = 'a' | 'u' | 'i' | null;

const FATHA_SIGN = /[\u{064B}\u{064E}\u{08F0}]/u;
const DAMMA_SIGN = /[\u{064C}\u{064F}\u{08F1}]/u;
const KASRA_SIGN = /[\u{064D}\u{0650}\u{08F2}]/u;
const TANWEEN_FATH = /[\u{064B}\u{08F0}]/u;
const SUKUN = '\u{0652}';
const HAMZA_SIGN = /[\u{0654}\u{0655}]/gu;
// Letters that never join the next one (a final hamza after one stays on
// the line: جزءا, ردءا; after a joining letter it sits on a tooth: خطئا).
const NON_JOINING =
  /[\u{0621}-\u{0625}\u{0627}\u{0629}\u{062F}-\u{0632}\u{0648}\u{0649}\u{0671}]/u;
const SEAT_OF: Readonly<Record<'a' | 'u' | 'i', string>> = {
  a: '\u{0623}',
  u: '\u{0624}',
  i: '\u{0626}',
};

interface Unit {
  letter: string;
  marks: string;
}

function unitsOf(word: string): Unit[] {
  const units: Unit[] = [];
  for (const char of word) {
    const last = units[units.length - 1];
    if (last && MARK.test(char)) last.marks += char;
    else units.push({letter: char, marks: ''});
  }
  return units;
}

function vowelOf(marks: string): Vowel {
  if (KASRA_SIGN.test(marks)) return 'i';
  if (DAMMA_SIGN.test(marks)) return 'u';
  if (FATHA_SIGN.test(marks)) return 'a';
  return null;
}

/** A hamza the text draws without a seat: on the line, or on a tatweel. */
function isUnseatedHamza(unit: Unit): boolean {
  return (
    unit.letter === '\u{0621}' ||
    (unit.letter === '\u{0640}' && /[\u{0654}\u{0655}]/u.test(unit.marks))
  );
}

/**
 * The everyday seats of the unseated hamza at units[i], by the usual rules
 * ([] when everyday writing keeps it on the line, or writes it with the
 * alif after it as آ):
 * - first in the word: on an alif (ءَأَنتُمْ → أأنتم), آ before a long alif;
 * - last in the word: on the line after a long vowel or a sukun (سماء, سوء,
 *   شيء, جزء); with the alif of a tanween fath, on a tooth after ي or a
 *   joining letter (شيئا, خطئا), on the line otherwise (جزءا, سوءا);
 * - inside the word: on the seat of the strongest vowel of the hamza and the
 *   letter before it, kasra (ئ) over damma (ؤ) over fatha (أ): يسألونك,
 *   رؤوف, الأفئدة; a fatha before a long alif gives آ (القرآن). After a
 *   long alif or waw, a fatha stays on the line (شركاءهم, سوءة), a damma
 *   takes ؤ (جاؤوا) and a kasra ئ (إسرائيل). After ي it sits on a tooth
 *   (خطيئة, كهيئة), and after a ي with a sukun also on an alif (ييأس).
 *   بِ or لِ before a hamza and a long alif is a proclitic (بآيات, لآدم).
 */
function everydaySeats(units: readonly Unit[], i: number): string[] {
  const unit = units[i];
  const own = vowelOf(unit.marks);
  const prev = units[i - 1];
  const next = units[i + 1];
  const alifAfter =
    unit.marks.includes('\u{0670}') || next?.letter === '\u{0627}';
  if (!prev) {
    if (own === 'a' && alifAfter) return [];
    return [own === 'i' ? '\u{0625}' : '\u{0623}'];
  }
  const before = vowelOf(prev.marks);
  const longAlif =
    prev.letter === '\u{0627}' || prev.marks.includes('\u{0670}');
  const yeh =
    (prev.letter === '\u{064A}' || prev.letter === '\u{0649}') &&
    before === null;
  const waw = prev.letter === '\u{0648}' && before === null;
  const tanweenAlif =
    TANWEEN_FATH.test(unit.marks) &&
    next?.letter === '\u{0627}' &&
    i + 2 === units.length;
  if (tanweenAlif) {
    if (yeh) return [SEAT_OF.i];
    if (before === 'i' || before === 'u') return [SEAT_OF[before]];
    if (before === null && !longAlif && !waw) {
      return NON_JOINING.test(prev.letter) ? [] : [SEAT_OF.i];
    }
    // After a fatha the alif goes (خطأ), which folds like the hamza
    // dropped; after a long alif or waw it stays on the line.
    return [];
  }
  if (!next) {
    if (before === null || longAlif || yeh || waw) return [];
    return [SEAT_OF[before]];
  }
  if (
    i === 1 &&
    (prev.letter === '\u{0628}' || prev.letter === '\u{0644}') &&
    before === 'i' &&
    own === 'a' &&
    alifAfter
  ) {
    return [];
  }
  if (longAlif || waw) {
    return own === 'i' || own === 'u' ? [SEAT_OF[own]] : [];
  }
  if (yeh) {
    return own === 'a' && prev.marks.includes(SUKUN)
      ? [SEAT_OF.i, SEAT_OF.a]
      : [SEAT_OF.i];
  }
  const vowels = [before, own];
  const strongest = vowels.includes('i')
    ? 'i'
    : vowels.includes('u')
      ? 'u'
      : vowels.includes('a')
        ? 'a'
        : null;
  if (strongest === null || (strongest === 'a' && alifAfter)) return [];
  return [SEAT_OF[strongest]];
}

/**
 * `word` with each hamza drawn on the line or on a tatweel written on its
 * everyday seat (يَسْـَٔلُونَكَ → يَسْأَلُونَكَ, رَءَى → رَأَى): the spellings
 * that differ from `word`, at most 4.
 */
function seatedHamzas(word: string): string[] {
  const units = unitsOf(word);
  let spellings: Unit[][] = [units];
  units.forEach((unit, i) => {
    if (!isUnseatedHamza(unit)) return;
    const seats = everydaySeats(units, i);
    if (!seats.length) return;
    const marks = unit.marks.replace(HAMZA_SIGN, '');
    spellings = spellings
      .flatMap(spelling =>
        seats.map(seat => {
          const copy = [...spelling];
          copy[i] = {letter: seat, marks};
          return copy;
        }),
      )
      .slice(0, 4);
  });
  const out: string[] = [];
  for (const spelling of spellings) {
    const text = spelling.map(u => u.letter + u.marks).join('');
    if (text !== word && !out.includes(text)) out.push(text);
  }
  return out;
}

function spellOutSmallLetter(
  _match: string,
  pronoun: string | undefined,
  small: string,
): string {
  if (pronoun !== undefined) return pronoun;
  return small === '\u{06E5}' ? '\u{0648}' : '\u{064A}';
}

/** Marks removed, letters folded, spaces removed. */
function fold(text: string): string {
  return foldHamzaCarriers(
    foldArabicLetters(text.replace(ARABIC_MARKS, '')),
  ).replace(/\s+/g, '');
}

interface Spellings {
  imlaei: string;
  alternates: string[];
  rasm: string;
  mixed: string[];
}

/** The small letters spelled out, the silent yeh dropped (before folding). */
function imlaeiBaseOf(word: string): string {
  return word
    .replace(MEDIAL_MAQSURA_DAGGER, '\u{0627}$1')
    .replace(WAW_ALIF, '\u{0627}')
    .replace(SMALL_HIGH_YEH, '\u{064A}')
    .replace(SMALL_HIGH_NOON, '\u{0646}')
    .replace(SMALL_WAW_YEH, spellOutSmallLetter)
    .replace(SILENT_YEH, '');
}

/** The spellings of a prepared word (see the file comment). */
function spellingsOf(prepared: string): Spellings {
  const word = prepared.trim().replace(VOCATIVE, '\u{064A}$1\u{0627}');
  const imlaeiBase = imlaeiBaseOf(word);
  const imlaei = fold(imlaeiBase.replace(DAGGER_ALIF, '\u{0627}'));
  // fold() drops the dagger alif and the small letters with the other marks.
  const rasm = fold(word);
  const alternates: string[] = [];
  const bases = [imlaeiBase, ...imlaeiAlternates(imlaeiBase)];
  if (HAMZA_BEFORE_SILENT_YEH.test(word)) {
    bases.push(
      imlaeiBaseOf(word.replace(HAMZA_BEFORE_SILENT_YEH, '\u{0626}$1')),
    );
  }
  for (const base of bases) {
    for (const alternate of [base, ...seatedHamzas(base)]) {
      const form = fold(alternate.replace(DAGGER_ALIF, '\u{0627}'));
      if (form && form !== imlaei && !alternates.includes(form)) {
        alternates.push(form);
      }
    }
  }
  const mixed: string[] = [];
  const parts = imlaeiBase.split('\u{0670}');
  const daggers = parts.length - 1;
  if (daggers >= 2 && daggers <= 3) {
    for (const written of choices(daggers)) {
      let out = parts[0];
      for (let i = 0; i < daggers; i++) {
        out += (written[i] ? '\u{0627}' : '') + parts[i + 1];
      }
      const form = fold(out);
      if (form !== imlaei && form !== rasm && !mixed.includes(form)) {
        mixed.push(form);
      }
    }
  }
  return {imlaei, alternates, rasm, mixed};
}

/** Every true/false choice for `n` items, all false first. */
function choices(n: number): boolean[][] {
  let out: boolean[][] = [[]];
  for (let i = 0; i < n; i++) {
    out = out.flatMap(choice => [
      [...choice, false],
      [...choice, true],
    ]);
  }
  return out;
}

export interface QuranWordSpellings {
  imlaei: string;
  /** Other everyday spellings of word-dependent conventions (يدعو, يبدأ). */
  alternates: readonly string[];
  rasm: string;
  /** Other alif combinations of words with 2-3 dagger alifs. */
  mixed: readonly string[];
  /** The word holds a hamza (ء, أ, إ, ؤ, ئ or a hamza sign). */
  hasHamza: boolean;
}

/** The folded spellings of one Uthmani word ('' for a verse marker). */
export function quranWordSpellings(uthmani: string): QuranWordSpellings {
  const prepared = prepare(uthmani);
  const {imlaei, alternates, rasm, mixed} = spellingsOf(prepared);
  return {imlaei, alternates, rasm, mixed, hasHamza: HAMZA.test(prepared)};
}

// ── Proclitics and the article ─────────────────────────────────────────────

export type QuranProclitic =
  | 'wa'
  | 'fa'
  | 'bi'
  | 'li'
  | 'ka'
  | 'sa'
  | 'hamza'
  | 'ya'
  | 'ha'
  | 'ta';

/** The i'rab data's names of the proclitics (entries of kind 'p'). */
const PROCLITIC_OF_LABEL: ReadonlyMap<string, QuranProclitic> = new Map([
  ['الواو', 'wa'],
  ['الفاء', 'fa'],
  ['الباء', 'bi'],
  ['اللام', 'li'],
  ['الكاف', 'ka'],
  ['الهمزة', 'hamza'],
  ['السين', 'sa'],
  ['يا', 'ya'],
  ['ها', 'ha'],
  ['التاء', 'ta'],
]);

/** The letters each proclitic may be written with in the Uthmani text. */
const PROCLITIC_LETTERS: Readonly<Record<QuranProclitic, string>> = {
  wa: 'و',
  fa: 'ف',
  bi: 'ب',
  li: 'ل',
  ka: 'ك',
  sa: 'س',
  ta: 'ت',
  // The question hamza: on an alif, or on the line before a hamza-alif
  // (ءَأَنذَرْتَهُمْ), where the word keeps its own alif.
  hamza: 'أإء',
  ya: 'ي',
  ha: 'ه',
};

export function procliticOfIrabLabel(label: string): QuranProclitic | null {
  return PROCLITIC_OF_LABEL.get(label) ?? null;
}

/**
 * `word` without its first letter (one of `letters`) and the marks on it,
 * or null when it does not start with one. يا and ها also lose their alif
 * (a dagger alif or a written one), and are not stripped without one:
 * هَلُمَّ is not ها + لُمَّ for a reader.
 */
function stripLetter(
  word: string,
  letters: string,
  withAlif: boolean,
): string | null {
  if (!word || !letters.includes(word[0])) return null;
  let i = 1;
  let alif = false;
  while (i < word.length && MARK.test(word[i])) {
    if (word[i] === '\u{0670}') alif = true;
    i++;
  }
  if (withAlif && !alif) {
    if (word[i] !== '\u{0627}') return null;
    i++;
    while (i < word.length && MARK.test(word[i])) i++;
  }
  const rest = word.slice(i);
  return ARABIC_LETTER.test(rest) ? rest : null;
}

function procliticChain(
  prepared: string,
  proclitics: readonly QuranProclitic[],
  definite: boolean,
  isAllah: boolean,
): string[] {
  const chain: string[] = [];
  let word = prepared.trim();
  for (let k = 0; k < proclitics.length; k++) {
    const p = proclitics[k];
    const rest = stripLetter(
      word,
      PROCLITIC_LETTERS[p],
      p === 'ya' || p === 'ha',
    );
    if (rest === null) break;
    word = rest;
    // لِلنَّاسِ is ل + ٱلنَّاسِ with the article's alif dropped: restore it
    // (and لِلَّهِ is ل + ٱللَّهِ with one lam dropped too).
    const last = k === proclitics.length - 1;
    if (last && p === 'li' && definite && word.startsWith('\u{0644}')) {
      word = (isAllah ? '\u{0671}\u{0644}' : '\u{0671}') + word;
    }
    chain.push(word);
  }
  return chain;
}

/**
 * The word without its first 1, 2, ... proclitics, as folded imla'i
 * spellings: وَبِٱلْءَاخِرَةِ with [wa, bi] gives [بالاخره, الاخره]. After a
 * final ل the article's alif is restored when the word is definite
 * (لِلنَّاسِ → الناس, لِلَّهِ → الله). Stops at a proclitic the word does not
 * start with.
 */
export function stripProclitics(
  uthmani: string,
  proclitics: readonly QuranProclitic[],
  definite: boolean,
  isAllah = false,
): string[] {
  return procliticChain(prepare(uthmani), proclitics, definite, isAllah).map(
    word => spellingsOf(word).imlaei,
  );
}

function stripArticleOf(prepared: string): string | null {
  const article = /^[\u{0671}\u{0627}]\u{0644}\p{M}*/u.exec(prepared.trim());
  if (!article) return null;
  const rest = prepared.trim().slice(article[0].length);
  return spellingsOf(rest).imlaei.length >= 2 ? rest : null;
}

/**
 * The folded imla'i spelling without a leading article, or null when the
 * word has none or fewer than 2 letters would remain (ٱلرَّحْمَٰنِ → رحمان).
 * Only for words the i'rab data calls معرفة بأل.
 */
export function stripArticle(uthmani: string): string | null {
  const rest = stripArticleOf(prepare(uthmani));
  return rest === null ? null : spellingsOf(rest).imlaei;
}

export const QURAN_TIER = {
  withoutArticle: 1,
  withoutProclitics: 2,
  full: 3,
} as const;
export type QuranTier = (typeof QURAN_TIER)[keyof typeof QURAN_TIER];

/** One search spelling of a word, with what the posting records about it. */
export interface QuranWordForm {
  form: string;
  tier: QuranTier;
  /** Only a rasm or mixed spelling gives this form. */
  rasmOnly: boolean;
  /** The part of the word this form spells holds a hamza. */
  hasHamza: boolean;
  /**
   * Only the letters exactly as drawn give this form: those of a vocative
   * (يَٰٓأَيُّهَا → يايها) or of a word drawn with one lam (ٱلَّيْل → اليل),
   * which every other spelling writes with the alif or lam everyday writing
   * adds. The index keeps such a form only where no other word has it.
   */
  asDrawn?: true;
}

/** What the i'rab data says about a word (all optional facts). */
export interface QuranWordMorph {
  proclitics: readonly QuranProclitic[];
  /** التعريف is exactly معرفة بأل. */
  definiteByArticle: boolean;
  /** الأصل المعجمي, the lemma in Uthmani spelling. */
  lemma: string | null;
  /** الجذر, the root in the corpus's spelling (ر ح م). */
  root?: string | null;
}

function formScore(form: QuranWordForm): number {
  return form.tier * 10 - (form.rasmOnly ? 5 : 0);
}

/**
 * Every search spelling of one Digital Khatt word, each with its best tier:
 * the full word (tier 3); without its first 1, 2, ... proclitics (tier 2);
 * without the article as well, for words defined by it (tier 1). Proclitics
 * come from the i'rab segmentation, never from guessing, so وَجْهَ never
 * gives جه. [] for a verse marker.
 */
export function quranWordForms(
  uthmani: string,
  morph?: QuranWordMorph,
): QuranWordForm[] {
  if (isVerseMarker(uthmani)) return [];
  const best = new Map<string, QuranWordForm>();
  const put = (candidate: QuranWordForm) => {
    if (!candidate.form) return;
    const current = best.get(candidate.form);
    if (!current || formScore(candidate) > formScore(current)) {
      best.set(candidate.form, candidate);
    }
  };
  const add = (word: string, tier: QuranTier) => {
    const {imlaei, alternates, rasm, mixed} = spellingsOf(word);
    const hasHamza = HAMZA.test(word);
    put({form: imlaei, tier, rasmOnly: false, hasHamza});
    for (const form of alternates) {
      put({form, tier, rasmOnly: false, hasHamza});
    }
    put({form: rasm, tier, rasmOnly: true, hasHamza});
    for (const form of mixed) put({form, tier, rasmOnly: true, hasHamza});
  };
  // The letters exactly as drawn (يَٰمُوسَىٰ → يموسي, وَٱلَّيْلِ → واليل): a
  // new form only where the spellings added the vocative's alif or a lam.
  const addDrawn = (word: string, tier: QuranTier) =>
    put({
      form: fold(word),
      tier,
      rasmOnly: true,
      hasHamza: HAMZA.test(word),
      asDrawn: true,
    });
  const prepared = prepare(uthmani);
  const drawn = prepareDrawn(uthmani);
  add(prepared, QURAN_TIER.full);
  addDrawn(drawn, QURAN_TIER.full);
  if (morph) {
    const lemma = morph.lemma ?? '';
    const definite = morph.definiteByArticle || lemma.startsWith('\u{0671}');
    const isAllah = lemma !== '' && fold(lemma) === 'الله';
    const chain = procliticChain(prepared, morph.proclitics, definite, isAllah);
    for (const word of chain) add(word, QURAN_TIER.withoutProclitics);
    for (const word of procliticChain(
      drawn,
      morph.proclitics,
      definite,
      isAllah,
    )) {
      addDrawn(word, QURAN_TIER.withoutProclitics);
    }
    const innermost = chain[chain.length - 1] ?? prepared;
    const bare = morph.definiteByArticle ? stripArticleOf(innermost) : null;
    if (bare !== null) add(bare, QURAN_TIER.withoutArticle);
    // Every everyday spelling (not the letters as drawn) ending in `ending`
    // also ends in `everyday`.
    const respell = (ending: string, everyday: string) => {
      for (const form of [...best.values()]) {
        if (form.form.endsWith(ending) && !form.rasmOnly) {
          put({
            ...form,
            form: form.form.slice(0, -ending.length) + everyday,
          });
        }
      }
    };
    // A feminine ending drawn as an open taa (رَحْمَتَ, نِعْمَتَ, ٱمْرَأَتُ) is
    // written ة in everyday writing. The lemma (رَحْمَة) says which final ت
    // is one: the word is the lemma with its ة drawn as ت. The letters as
    // drawn keep their ت (غَيَٰبَتِ is غيابة or غيبت, never غيبة).
    const stem = spellingsOf(innermost).imlaei;
    const lemmaSpelling = lemma ? spellingsOf(prepare(lemma)).imlaei : '';
    if (
      stem.length > 1 &&
      stem.endsWith('ت') &&
      lemmaSpelling.endsWith('ه') &&
      stem.slice(0, -1) === lemmaSpelling.slice(0, -1)
    ) {
      respell('ت', 'ه');
    }
    // An alif maqsura drawn as a final alif (طَغَا, لَدَا, ٱلْأَقْصَا) is
    // written ى in everyday writing. The lemma written with ى (طَغَىٰ,
    // لَدَى) says which final ا is one: the word, with or without its
    // article, is the lemma with its ى drawn as ا.
    if (
      /\u{0649}\p{M}*$/u.test(prepare(lemma)) &&
      [innermost, bare].some(word => {
        const spelling = word === null ? '' : spellingsOf(word).imlaei;
        return (
          spelling.length > 1 &&
          spelling.endsWith('ا') &&
          spelling.slice(0, -1) === lemmaSpelling.slice(0, -1)
        );
      })
    ) {
      respell('ا', 'ي');
    }
    const core = innermost.trim();
    // A verb whose plural waw is drawn with a sukun and no alif (وَعَتَوْ,
    // سَعَوْ) is written with the alif; لَوْ and أَوْ are of two letters.
    if (
      /\u{064E}\u{0648}\u{0652}\p{M}*$/u.test(core) &&
      [...core].filter(char => !MARK.test(char)).length >= 3
    ) {
      respell('و', 'وا');
    }
    // A word of the root ح ي ي drawn with one final yeh (يُحْيِ, لَمُحْيِ)
    // is written with both (يحيي, لمحيي); وَحْيِ, of و ح ي, keeps one.
    if (
      morph.root === 'ح ي ي' &&
      /\u{0652}\u{064A}\u{0650}\p{M}*$/u.test(core)
    ) {
      respell('ي', 'يي');
    }
  }
  return [...best.values()];
}

// ── Queries ────────────────────────────────────────────────────────────────

export interface QuranQueryToken {
  /** Folded keys to look up: the token, then its hamza-seat variants. */
  keys: readonly string[];
  /** Typed with a hamza: only words with a hamza match. */
  needsHamza: boolean;
  /**
   * A surah opening typed as letters (ا ل م, ح م, ن; also before other
   * words) or pasted from the mushaf (الٓمٓ): only whole words without a
   * hamza match, so ا ل م finds الٓمٓ and not ألم or الملك.
   */
  opening?: true;
}

/**
 * The surah openings drawn as separate letters (al-muqatta'at), folded:
 * الم (2:1, 3:1, 29:1, 30:1, 31:1, 32:1), المص (7:1), الر (10:1, 11:1,
 * 12:1, 14:1, 15:1), المر (13:1), كهيعص (19:1), طه (20:1), طسم (26:1,
 * 28:1), طس (27:1), يس (36:1), ص (38:1), حم (40:1-46:1), عسق (42:2, after
 * حم), ق (50:1) and ن (68:1). The Digital Khatt text draws them with a
 * maddah over the letters (الٓمٓ, عٓسٓقٓ) and pause marks (الٓرۚ), which the
 * folds remove; طه has no marks.
 */
export const QURAN_OPENINGS: ReadonlySet<string> = new Set([
  'الم',
  'المص',
  'الر',
  'المر',
  'كهيعص',
  'طه',
  'طسم',
  'طس',
  'يس',
  'ص',
  'حم',
  'عسق',
  'ق',
  'ن',
]);

export type ParsedQuranQuery =
  | {kind: 'none'}
  | {
      kind: 'text';
      tokens: readonly QuranQueryToken[];
      /** A one-word query of 3-4 letters, as typed, for root suggestions. */
      rootLetters: string | null;
    }
  | {kind: 'root'; letters: string; explicit: boolean};

/** The folded imla'i key of one query token (pasted Uthmani included). */
function queryKey(token: string): string {
  return spellingsOf(prepare(token)).imlaei;
}

/**
 * One typed word folded like a query word, without seat variants: the
 * spelling an imla'i text supplies for a slot (the build's --imlaei seam).
 */
export function foldQuranQueryWord(word: string): string {
  return queryKey(
    word.replace(MADDAH, '').normalize('NFKC').replace(BIDI_AND_ZERO_WIDTH, ''),
  );
}

/**
 * The keys of a token (one typed word, or two joined: يا + أيها): the token
 * itself, and each hamza seat also without its seat letter: ؤ and ئ
 * anywhere, أ and إ after a word's first letter (مسؤولا → مسوولا, مسولا;
 * يسألونك → يسالونك, يسلونك; أأنتم → اانتم, انتم), as a reader may put
 * the hamza on another seat than the index's spellings. At most 2 seats, so
 * at most 4 keys, the token as typed first. A key without a seat letter is
 * often another word (امرأة → امره, as أمره), so the engine looks the
 * others up only when the first is no word of the text.
 */
function tokenKeys(words: readonly string[]): string[] {
  const chars: string[] = [];
  const seats: number[] = [];
  for (const word of words) {
    [...word].forEach((c, i) => {
      if (c === 'ؤ' || c === 'ئ' || ((c === 'أ' || c === 'إ') && i > 0)) {
        seats.push(chars.length);
      }
      chars.push(c);
    });
  }
  seats.splice(2);
  const keys: string[] = [];
  for (const dropped of choices(seats.length)) {
    const copy = [...chars];
    seats.forEach((at, j) => {
      if (dropped[j]) copy[at] = '';
    });
    const key = queryKey(copy.join(''));
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** The letters of a token, marks removed, hamza kept (for roots). */
function rawLetters(token: string): string {
  return prepare(token)
    .replace(ARABIC_MARKS, '')
    .replace(/[^\p{L}]/gu, '');
}

/**
 * A word the Uthmani text joins to the next one: the vocative يا and ها typed
 * without a hamza (يا أيها → ياايها, ها أنتم → هاانتم), and إل of إل ياسين.
 * Not آل or ال: «آل فرعون» is two words in the mushaf too.
 */
function joinsNextWord(word: string): boolean {
  const letters = rawLetters(word);
  if (letters === 'إل') return true;
  // A vocative typed with its conjunction (ويا قوم) is one Uthmani word too
  // (وَيَٰقَوْمِ), and so is one typed with a Persian yeh (یا). @ai
  const bare = foldArabicLetters(letters).replace(
    /^\u{0648}(?=\u{064A}\u{0627}$)/u,
    '',
  ); // @ai
  return (bare === 'يا' || bare === 'ها') && !HAMZA.test(word);
}

/**
 * Whether a query starts with a surah opening as the mushaf draws it: a
 * word whose letters spell an opening and that carries a maddah (الٓمٓ,
 * حمٓ, نٓۚ). No other word of the Hafs text does both (ألم has no maddah,
 * and طه, which has none, is only ever the opening), so a pasted opening is
 * never ألم.
 */
function startsWithDrawnOpening(query: string): boolean {
  const first = query.trim().split(/\s+/u)[0] ?? '';
  return (
    first.includes('\u{0653}') && QURAN_OPENINGS.has(fold(rawLetters(first)))
  );
}

/**
 * Parses a search query. A query with a digit or without an Arabic letter
 * is not a Quran query ('2:255', 'صفحة 5', 'juz 30', reciter names).
 * `root:رحم` / `جذر: ر ح م` ask for a root; 3-4 spaced letters (ر ح م) do
 * too when they spell a known root, unless they spell a surah opening
 * (QURAN_OPENINGS: ا ل م is the text الم, its root ء ل م only a suggestion).
 * Letters typed apart before other words that spell an opening, and a first
 * word pasted as the mushaf draws an opening (الٓمٓ), are that opening too.
 * Otherwise the text is split into words; a standalone يا, ها or إل joins
 * the next word (يا أيها → ياايها), as the Uthmani text writes them as one.
 *
 * The root list (`isKnownRoot`) decides between a root and text for spaced
 * letters, so only QuranSearchDataService, which holds it, parses for the
 * app: the surfaces read the kind from its outcome. Without the list,
 * spaced letters are text; whether a query is `none` never depends on it.
 */
export function parseQuranQuery(
  query: string,
  isKnownRoot: (root: string) => boolean = () => false,
): ParsedQuranQuery {
  const drawnOpening = startsWithDrawnOpening(query);
  let text = query
    .replace(MADDAH, '')
    .normalize('NFKC')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(BIDI_AND_ZERO_WIDTH, '')
    .toLowerCase()
    .slice(0, QURAN_QUERY_INPUT_LIMIT);

  const rootPrefix = ROOT_PREFIX.exec(text);
  if (rootPrefix) {
    const letters = rawLetters(text.slice(rootPrefix[0].length));
    if (!letters || /[0-9]/.test(text)) return {kind: 'none'};
    return {kind: 'root', letters, explicit: true};
  }

  text = text.replace(VERSE_END, ' ').replace(ORNATE_VERSE_NUMBER, ' ');
  if (/[0-9]/.test(text)) return {kind: 'none'};
  const words = prepare(text)
    .replace(/[^\p{L}\p{M}]+/gu, ' ')
    .split(' ')
    .filter(word => ARABIC_LETTER.test(word));
  if (!words.length) return {kind: 'none'};

  // Single letters typed apart (or one letter): a surah opening (ا ل م, ح م,
  // ك ه ي ع ص, ن), text matched as a whole word; else a root when 3-4 of
  // them spell a known one (ر ح م); else one word. The openings are drawn
  // without a hamza, so letters typed with one (أ ل م) are not an opening.
  let opening = false;
  // The first word is an opening (its letters typed apart, words after).
  let leadOpening = false;
  const isOpening = (letters: readonly string[]) =>
    !letters.some(word => HAMZA.test(word)) &&
    QURAN_OPENINGS.has(fold(letters.map(rawLetters).join('')));
  if (words.length <= 5 && words.every(word => rawLetters(word).length === 1)) {
    const letters = words.map(rawLetters).join('');
    opening = isOpening(words);
    if (
      !opening &&
      words.length <= 4 &&
      words.length >= 3 &&
      rootCandidates(letters, isKnownRoot).length > 0
    ) {
      return {kind: 'root', letters, explicit: false};
    }
    words.splice(0, words.length, words.join(''));
  } else {
    // Letters typed apart before other words (ا ل ر تلك آيات الكتاب, ح م
    // تنزيل): when they spell an opening, that opening as one word.
    let lead = 0;
    while (lead < words.length && rawLetters(words[lead]).length === 1) lead++;
    if (lead >= 1 && lead <= 5 && isOpening(words.slice(0, lead))) {
      words.splice(0, lead, words.slice(0, lead).join(''));
      leadOpening = true;
    } else if (drawnOpening) {
      // Pasted from the mushaf (الٓمٓ): the opening, alone or before words.
      if (words.length === 1) opening = true;
      else leadOpening = true;
    }
  }

  const merged: string[][] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (i + 1 < words.length && joinsNextWord(word)) {
      merged.push([word, words[i + 1]]);
      i++;
    } else {
      merged.push([word]);
    }
  }

  // The length cap counts letters, not marks: a pasted Uthmani phrase is
  // about twice as long with its harakat, and is never cut inside a word.
  const tokens: QuranQueryToken[] = [];
  const tokenWords: string[] = [];
  let letters = 0;
  for (const parts of merged) {
    if (tokens.length === QURAN_QUERY_MAX_TOKENS) break;
    const keys = tokenKeys(parts);
    if (!keys.length) continue;
    letters += keys[0].length;
    if (letters > QURAN_QUERY_MAX_LENGTH) break;
    const word = parts.join('');
    const token: QuranQueryToken = {
      keys,
      needsHamza: HAMZA.test(prepare(word)),
    };
    if (opening || (leadOpening && !tokens.length)) token.opening = true;
    tokens.push(token);
    tokenWords.push(word);
  }
  if (!tokens.length) return {kind: 'none'};
  const single = tokens.length === 1 ? rawLetters(tokenWords[0]) : '';
  return {
    kind: 'text',
    tokens,
    rootLetters: single.length >= 3 && single.length <= 4 ? single : null,
  };
}

/** The root letters a typed letter may stand for (hamza seats, weak alif). */
function rootLetterOptions(letter: string): string[] {
  switch (letter) {
    case 'أ':
    case 'إ':
    case 'آ':
    case 'ء':
      return ['ء'];
    case 'ا':
    case 'ٱ':
      return ['ء', 'و', 'ي'];
    case 'ؤ':
      return ['ء', 'و'];
    case 'ئ':
      return ['ء', 'ي'];
    case 'ى':
      return ['ي', 'و'];
    default: {
      const folded = foldArabicLetters(letter);
      return /^[\u{0628}-\u{063A}\u{0641}-\u{064A}]$/u.test(folded) &&
        folded !== 'ة' &&
        folded !== 'ى'
        ? [folded]
        : [];
    }
  }
}

/**
 * The known roots that 3-4 typed letters may spell, in the i'rab format
 * ('ر ح م'): أ إ آ ء → ء; ا → ء, و or ي; ؤ → ء or و; ئ → ء or ي; ى → ي or
 * و. `isKnownRoot` keeps the roots that occur in the Quran.
 */
export function rootCandidates(
  letters: string,
  isKnownRoot: (root: string) => boolean,
): string[] {
  const chars = [...rawLetters(letters)];
  if (chars.length < 3 || chars.length > 4) return [];
  let roots: string[][] = [[]];
  for (const char of chars) {
    const options = rootLetterOptions(char);
    if (!options.length) return [];
    roots = roots.flatMap(root => options.map(option => [...root, option]));
  }
  const out: string[] = [];
  for (const root of roots) {
    const key = root.join(' ');
    if (!out.includes(key) && isKnownRoot(key)) out.push(key);
  }
  return out;
}

/** The query that searches a root: rootQuery('ر ح م') → 'root:ر ح م'. */
export function rootQuery(root: string, keyword = 'root'): string {
  return `${keyword}:${root}`;
}
