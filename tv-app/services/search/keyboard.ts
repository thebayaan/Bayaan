/**
 * The on-screen keyboard's layouts and editing rules. Every layout is the same
 * 7 x 4 grid, so a key keeps its place (and the focus engine its target) when
 * the mode changes.
 */

export type KeyboardMode = 'letters' | 'numbers' | 'arabic';

export const KEY_COLUMNS = 7;
export const MAX_QUERY_CHARS = 40;

const LETTERS = [
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  ['h', 'i', 'j', 'k', 'l', 'm', 'n'],
  ['o', 'p', 'q', 'r', 's', 't', 'u'],
  ['v', 'w', 'x', 'y', 'z', "'", '-'],
];

// Digits plus what verse references and surah names need ("2:255").
const NUMBERS = [
  ['1', '2', '3', '4', '5', '6', '7'],
  ['8', '9', '0', ':', '.', '-', "'"],
  ['', '', '', '', '', '', ''],
  ['', '', '', '', '', '', ''],
];

const ARABIC = [
  ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'],
  ['د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص'],
  ['ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق'],
  ['ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'],
];

export function keyRows(mode: KeyboardMode): readonly (readonly string[])[] {
  if (mode === 'numbers') return NUMBERS;
  if (mode === 'arabic') return ARABIC;
  return LETTERS;
}

/** letters -> numbers -> Arabic -> letters. */
export function nextMode(mode: KeyboardMode): KeyboardMode {
  if (mode === 'letters') return 'numbers';
  if (mode === 'numbers') return 'arabic';
  return 'letters';
}

/** The mode key shows where it goes next. */
export function modeKeyLabel(mode: KeyboardMode): string {
  const next = nextMode(mode);
  if (next === 'numbers') return '123';
  if (next === 'arabic') return 'عربي';
  return 'abc';
}

export function typeKey(query: string, key: string): string {
  if (!key || query.length >= MAX_QUERY_CHARS) return query;
  return query + key;
}

/** No leading space and no doubled spaces: both only cost presses. */
export function typeSpace(query: string): string {
  if (query.length === 0 || query.endsWith(' ')) return query;
  return typeKey(query, ' ');
}

export function deleteKey(query: string): string {
  // Code points, so a non-BMP character is deleted whole.
  return Array.from(query).slice(0, -1).join('');
}
