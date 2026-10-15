// @ai-generated

// Standard Arabic (101) layout, unshifted keys. "b" produces the lam-alef
// ligature as two letters.
const LATIN_TO_ARABIC: Readonly<Record<string, string>> = {
  '`': 'ذ',
  q: 'ض',
  w: 'ص',
  e: 'ث',
  r: 'ق',
  t: 'ف',
  y: 'غ',
  u: 'ع',
  i: 'ه',
  o: 'خ',
  p: 'ح',
  '[': 'ج',
  ']': 'د',
  a: 'ش',
  s: 'س',
  d: 'ي',
  f: 'ب',
  g: 'ل',
  h: 'ا',
  j: 'ت',
  k: 'ن',
  l: 'م',
  ';': 'ك',
  "'": 'ط',
  z: 'ئ',
  x: 'ء',
  c: 'ؤ',
  v: 'ر',
  b: 'لا',
  n: 'ى',
  m: 'ة',
  ',': 'و',
  '.': 'ز',
  '/': 'ظ',
};

const ARABIC_TO_LATIN: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(LATIN_TO_ARABIC)
    .filter(([, arabic]) => arabic.length === 1)
    .map(([latin, arabic]) => [arabic, latin]),
);

const HAS_ARABIC = /[؀-ۿ]/;
const HAS_LATIN = /[a-z]/i;

function mapChars(
  text: string,
  table: Readonly<Record<string, string>>,
): string {
  return [...text].map(char => table[char] ?? char).join('');
}

/** The same keystrokes typed on the other layout, or null if not applicable. */
export function swapKeyboardLayout(query: string): string | null {
  const text = query.trim().toLowerCase();
  if (text.replace(/\s/g, '').length < 3) return null;
  const arabic = HAS_ARABIC.test(text);
  const latin = HAS_LATIN.test(text);
  if (arabic === latin) return null;
  return arabic
    ? mapChars(text, ARABIC_TO_LATIN)
    : mapChars(text, LATIN_TO_ARABIC);
}
