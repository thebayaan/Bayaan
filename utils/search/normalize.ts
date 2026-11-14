// @ai-generated

// @ai-start
/**
 * Arabic marks that never change which letters a word has: the combining
 * grapheme joiner (U+034F), Quranic annotation signs (U+0610-061A), harakat,
 * shadda, sukun and the hamza and madda signs (U+064B-065F), the dagger alif
 * (U+0670), pause signs and small Quranic letters (U+06D6-06ED, which also
 * holds the end-of-ayah, rub el hizb and sajdah signs), the open tanween of
 * the Digital Khatt text (U+08D3-08FF) and tatweel (U+0640). Global: use it
 * with `replace`, not `test`.
 */
export const ARABIC_MARKS =
  /[\u034f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u08d3-\u08ff\u0640]/g;

/** ٱ أ إ آ → ا, ى ی → ي, ک → ك, ة → ه. */
export function foldArabicLetters(text: string): string {
  return text
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه');
}

/** ؤ → و, ئ → ي; a hamza on the line (ء) is dropped. */
export function foldHamzaCarriers(text: string): string {
  return text.replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '');
}
// @ai-end

/**
 * Display-safe normalization shared with the Mushaf command parser. Keeps
 * ':' and hamza so "2:255" and "جزء" still parse. Do not add folding here;
 * matching-only folding belongs in toSearchKey.
 */
export function normalizeSearchText(text: string): string {
  // @ai-start
  return foldArabicLetters(
    text
      .normalize('NFKC')
      .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
      .replace(ARABIC_MARKS, '')
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ''),
  )
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  // @ai-end
}

/**
 * Matching key: normalizeSearchText plus Latin accent stripping, hamza
 * carrier folding, apostrophe removal and punctuation-to-space. Only ever
 * compared against other keys; never shown to the user.
 */
export function toSearchKey(text: string): string {
  // @ai-start
  return foldHamzaCarriers(
    normalizeSearchText(text)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .normalize('NFC')
      .replace(/\u200b|\u200c|\u200d|\ufeff/g, ''),
  )
    .replace(/['’‘`´ʼʻ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  // @ai-end
}

export function tokenize(key: string): string[] {
  return key ? key.split(' ') : [];
}

/** Romanized Arabic articles and name particles ignored by skeleton matching. */
export const ARTICLES: ReadonlySet<string> = new Set([
  'al',
  'el',
  'an',
  'ar',
  'as',
  'ash',
  'at',
  'ad',
  'az',
  'ul',
  'ibn',
  'bin',
  'ben',
]);

/**
 * Consonant skeleton of a romanized Arabic word, so transliteration variants
 * collide: hussary/husary/hosary -> "hsr", abdulbasit/abdelbaset -> "abdbst".
 * Steps: drop a glued "al"/"el" article, fold "abd + al/ul/el (+ sun letter)"
 * to "abd", keep the first letter, drop later vowels (and y), q -> k,
 * ph -> f, then collapse doubled letters. Non-Latin tokens pass through.
 */
/** "alafasi" -> "afasi": a romanized article glued to the word. */
export function stripLatinArticle(token: string): string {
  return token.length > 4 && /^(al|el)[a-z]/.test(token)
    ? token.slice(2)
    : token;
}

/**
 * "البقره" -> "بقره": Arabic names carry the article inside the token, so
 * prefix matching ("بق") and typo budgets work on the word without it.
 */
export function stripArabicArticle(token: string): string {
  return token.length > 3 && token.startsWith('ال') ? token.slice(2) : token;
}

export function latinSkeleton(token: string): string {
  if (!/^[a-z]+$/.test(token)) return token;
  let word = stripLatinArticle(token);
  word = word.replace(/^abd[uea]?[lrsnzdt]?(?=[a-z]{3}|$)/, 'abd');
  const first = word[0] === 'q' ? 'k' : word[0];
  const rest = word
    .slice(1)
    .replace(/ph/g, 'f')
    .replace(/q/g, 'k')
    .replace(/[aeiouy]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}
