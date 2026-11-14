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
export const QURAN_TEXT_NORMALIZER_VERSION = 1;

/** Queries are cut to this many tokens and characters. */
export const QURAN_QUERY_MAX_TOKENS = 24;
export const QURAN_QUERY_MAX_LENGTH = 200;

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
// ىٰ is a written alif maqsura: the dagger alif on it is not another alif.
const MAQSURA_DAGGER = /\u{0649}([\u{064B}-\u{0652}]*)\u{0670}/gu;
// The vocative يا is always written with an alif (يَٰقَوْمِ, يَٰٓأَيُّهَا).
const VOCATIVE = /^\u{064A}([\u{064B}-\u{0652}]*)\u{0670}/u;
// ٱلَّيْل (al-layl) is drawn with one lam; everyday writing has two (الليل).
const LAYL =
  /\u{0671}\u{0644}([\u{064B}-\u{0652}]*\u{0651}[\u{064B}-\u{0652}]*)\u{064A}([\u{064B}-\u{0652}]*)\u{0644}/gu;
// A bare waw before a dagger alif is read as alif (ٱلصَّلَوٰةَ, ٱلرِّبَوٰا۟).
const WAW_ALIF = /\u{0648}\u{0670}(?:\u{0627}\u{06DF})?/gu;
const DAGGER_ALIF = /\u{0670}/gu;
const SMALL_HIGH_YEH = /\u{06E7}/gu;
const HAMZA = /[\u{0621}-\u{0626}]|[\u{0654}-\u{0655}]/u;
const MARK = /\p{M}/u;
const ARABIC_LETTER =
  /[\u{0621}-\u{063A}\u{0641}-\u{064A}\u{0671}\u{06A9}\u{06CC}]/u;
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

/** Maddah removed, NFC, decorations removed, ىٰ → ى, al-layl's lam. */
function prepare(text: string): string {
  return text
    .replace(MADDAH, '')
    .normalize('NFC')
    .replace(VERSE_END, ' ')
    .replace(DECORATIONS, '')
    .replace(MAQSURA_DAGGER, '\u{0649}$1')
    .replace(LAYL, '\u{0671}\u{0644}\u{0644}$1\u{064A}$2\u{0644}');
}

/** Marks removed, letters folded, spaces removed. */
function fold(text: string): string {
  return foldHamzaCarriers(
    foldArabicLetters(text.replace(ARABIC_MARKS, '')),
  ).replace(/\s+/g, '');
}

interface Spellings {
  imlaei: string;
  rasm: string;
  mixed: string[];
}

/** The spellings of a prepared word (see the file comment). */
function spellingsOf(prepared: string): Spellings {
  const word = prepared.trim().replace(VOCATIVE, '\u{064A}$1\u{0627}');
  const imlaeiBase = word
    .replace(WAW_ALIF, '\u{0627}')
    .replace(SMALL_HIGH_YEH, '\u{064A}');
  const imlaei = fold(imlaeiBase.replace(DAGGER_ALIF, '\u{0627}'));
  // fold() drops the dagger alif and the small yeh with the other marks.
  const rasm = fold(word);
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
  return {imlaei, rasm, mixed};
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
  rasm: string;
  /** Other alif combinations of words with 2-3 dagger alifs. */
  mixed: readonly string[];
  /** The word holds a hamza (ء, أ, إ, ؤ, ئ or a hamza sign). */
  hasHamza: boolean;
}

/** The folded spellings of one Uthmani word ('' for a verse marker). */
export function quranWordSpellings(uthmani: string): QuranWordSpellings {
  const prepared = prepare(uthmani);
  const {imlaei, rasm, mixed} = spellingsOf(prepared);
  return {imlaei, rasm, mixed, hasHamza: HAMZA.test(prepared)};
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
}

/** What the i'rab data says about a word (all optional facts). */
export interface QuranWordMorph {
  proclitics: readonly QuranProclitic[];
  /** التعريف is exactly معرفة بأل. */
  definiteByArticle: boolean;
  /** الأصل المعجمي, the lemma in Uthmani spelling. */
  lemma: string | null;
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
    const {imlaei, rasm, mixed} = spellingsOf(word);
    const hasHamza = HAMZA.test(word);
    put({form: imlaei, tier, rasmOnly: false, hasHamza});
    put({form: rasm, tier, rasmOnly: true, hasHamza});
    for (const form of mixed) put({form, tier, rasmOnly: true, hasHamza});
  };
  const prepared = prepare(uthmani);
  add(prepared, QURAN_TIER.full);
  if (morph) {
    const lemma = morph.lemma ?? '';
    const definite = morph.definiteByArticle || lemma.startsWith('\u{0671}');
    const isAllah = lemma !== '' && fold(lemma) === 'الله';
    const chain = procliticChain(prepared, morph.proclitics, definite, isAllah);
    for (const word of chain) add(word, QURAN_TIER.withoutProclitics);
    if (morph.definiteByArticle) {
      const bare = stripArticleOf(chain[chain.length - 1] ?? prepared);
      if (bare !== null) add(bare, QURAN_TIER.withoutArticle);
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
}

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
 * The keys of a token: the token itself, and each ؤ or ئ also without its
 * seat (مسؤولا → مسوولا, مسولا; the Uthmani text often writes that hamza
 * without one). At most 2 seats, so at most 4 keys.
 */
function tokenKeys(token: string): string[] {
  const chars = [...token];
  const seats = chars
    .map((c, i) => (c === 'ؤ' || c === 'ئ' ? i : -1))
    .filter(i => i >= 0)
    .slice(0, 2);
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

const MERGED_PARTICLES: ReadonlySet<string> = new Set(['يا', 'ها', 'ال']);

/**
 * Parses a search query. A query with a digit or without an Arabic letter
 * is not a Quran query ('2:255', 'صفحة 5', 'juz 30', reciter names).
 * `root:رحم` / `جذر: ر ح م` ask for a root; 3-4 spaced letters (ر ح م) do
 * too when they spell a known root. Otherwise the text is split into words:
 * a standalone يا, ها or ال joins the next word (يا أيها → ياايها), as the
 * Uthmani text writes them as one.
 */
export function parseQuranQuery(
  query: string,
  isKnownRoot: (root: string) => boolean = () => false,
): ParsedQuranQuery {
  let text = query
    .replace(MADDAH, '')
    .normalize('NFKC')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(BIDI_AND_ZERO_WIDTH, '')
    .toLowerCase()
    .slice(0, QURAN_QUERY_MAX_LENGTH);

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

  // Spaced single letters: a root (ر ح م), or muqatta'at (ح م, ك ه ي ع ص).
  if (
    words.length >= 2 &&
    words.length <= 5 &&
    words.every(word => rawLetters(word).length === 1)
  ) {
    const letters = words.map(rawLetters).join('');
    if (
      words.length <= 4 &&
      words.length >= 3 &&
      rootCandidates(letters, isKnownRoot).length > 0
    ) {
      return {kind: 'root', letters, explicit: false};
    }
    words.splice(0, words.length, words.join(''));
  }

  const merged: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (
      i + 1 < words.length &&
      !word.includes('ء') &&
      MERGED_PARTICLES.has(queryKey(word))
    ) {
      merged.push(word + words[i + 1]);
      i++;
    } else {
      merged.push(word);
    }
  }

  const tokens: QuranQueryToken[] = [];
  for (const word of merged.slice(0, QURAN_QUERY_MAX_TOKENS)) {
    const keys = tokenKeys(word);
    if (keys.length) {
      tokens.push({keys, needsHamza: HAMZA.test(prepare(word))});
    }
  }
  if (!tokens.length) return {kind: 'none'};
  const single = tokens.length === 1 ? rawLetters(merged[0]) : '';
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
