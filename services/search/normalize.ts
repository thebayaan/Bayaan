const TASHKEEL_RE = /[ً-ْٰـ]/g;
const LATIN_DIACRITICS_RE = /[̀-ͯ]/g;

export function normalize(input: string): string {
  if (!input) return '';
  // Fold Arabic letter variants before NFD so they match in composed form.
  let s = input.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  // NFD + strip Latin combining diacritics, then lowercase.
  s = s.normalize('NFD').replace(LATIN_DIACRITICS_RE, '');
  s = s.toLowerCase();
  s = s.replace(TASHKEEL_RE, '');
  s = s.replace(/[^a-z0-9؀-ۿ\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function tokenize(input: string): string[] {
  const n = normalize(input);
  return n === '' ? [] : n.split(' ');
}
