// @ai-generated
import type {
  GharibEntry,
  RasmNote,
  WordRasm,
  WordStudySource,
} from '@/services/wordStudy/wordStudyFormat';

export const BOOK: WordStudySource = {
  id: 327,
  kind: 'gharib',
  ord: 1,
  nameAr: 'كتاب الغريب',
  nameEn: 'Book of gharib',
  authorAr: 'مؤلف',
  authorEn: 'Author',
  viaAr: 'ناشر',
  viaEn: 'Publisher',
  url: 'https://example.org',
  version: 'v1',
};

export const TEXT: WordStudySource = {
  ...BOOK,
  id: 1,
  kind: 'rasm',
  viaAr: 'مشروع النص',
  viaEn: 'Text Project',
};

/** Words of 1:4 as the app has them. */
export const WORDS: Record<number, string> = {
  1: 'مَـٰلِكِ',
  2: 'يَوْمِ',
  3: 'ٱلدِّينِ',
};
export const wordTextOf = (p: number) => WORDS[p];

export function entry(
  ord: number,
  span: [number, number] | null,
  gloss: string,
): GharibEntry {
  return {
    source: BOOK,
    verseKey: '1:4',
    ord,
    span,
    headword: 'كلمة',
    gloss,
    note: '',
    part: '',
    page: '',
  };
}

export const hadhf: RasmNote = {
  kind: 'hadhf',
  standard: 'ا',
  mushaf: '',
  mark: [2, 3],
  basis: 'sign',
};

export function unit(notes: RasmNote[]): WordRasm {
  return {
    source: TEXT,
    verseKey: '1:4',
    from: 1,
    to: 1,
    imlaei: 'مَالِكِ',
    notes,
    reviewed: false,
  };
}

/** Every string of a rendered tree, in order. */
export function allText(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(allText).join('');
  const children = (node as {children?: unknown}).children;
  return children ? allText(children) : '';
}
