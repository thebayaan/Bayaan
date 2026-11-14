// @ai-generated
/**
 * Word study data: Arabic word meanings (gharib) and rasm. The types, codes,
 * decoders and lookups that the app (WordStudyDataService) and the build
 * scripts (scripts/word-study/) share. Pure: no React Native imports.
 *
 * Keys. Every record points at a Hafs word as a HafsWordKey "s:a:w" in the
 * app's word-by-word numbering: data/wbw/wbw-en.db, the i'rab numbering and
 * the position WBWVerseView reports. Digital Khatt and the rewayah word DBs
 * number differently in 2:181, 8:6 and 13:37, where they split بَعْدَ مَا
 * into two words; a caller holding a DK location maps it first.
 *
 * Quran text. The data never supplies the mushaf text: the Uthmani word on
 * screen is always the app's own. It supplies only the standard (imla'i)
 * spelling, shown as such, and a book's headword for entries placed on no
 * word.
 */

/** "s:a:w" in the app's word-by-word (i'rab) numbering. */
export type HafsWordKey = string;

export type WordStudyKind = 'gharib' | 'rasm';

/** A book or text the data comes from (one row of a DB's `sources` table). */
export interface WordStudySource {
  id: number;
  kind: WordStudyKind;
  /** Display order chosen by the team, lowest first. */
  ord: number;
  nameAr: string;
  nameEn: string;
  authorAr: string;
  authorEn: string;
  /** Who published the data, e.g. «الموسوعة القرآنية (quranpedia.net)». */
  viaAr: string;
  viaEn: string;
  url: string;
  version: string;
}

/** One explanation from a gharib book. */
export interface GharibEntry {
  source: WordStudySource;
  verseKey: string;
  /** The entry's order inside its book. */
  ord: number;
  /**
   * First and last app word the entry explains. null: verse level, placed
   * on no word (never shown on a word).
   */
  span: [number, number] | null;
  /** As printed in the book. Shown only for verse-level entries. */
  headword: string;
  /** The book's Arabic explanation. */
  gloss: string;
  /** '' when none. */
  note: string;
  /** Volume and page of the edition; '' when the source has none. */
  part: string;
  page: string;
}

export type RasmKind = 'hadhf' | 'ziyada' | 'badal' | 'hamz' | 'wasl' | 'fasl';

/**
 * What confirms a rasm note. Only a confirmed note is shown; an unconfirmed
 * one is stored for review but hidden.
 *  - sign: the mushaf's own signs (a small letter, ۟ or ۠, ٰ on و or ى, the
 *    small seen on ص, or the hamza as the mushaf writes it);
 *  - rule: one of the named pattern rules in scripts/word-study/rasm.ts;
 *  - reviewed: listed in scripts/word-study/rasm-reviewed.json;
 *  - unconfirmed: none of these.
 */
export type RasmBasis = 'sign' | 'rule' | 'reviewed' | 'unconfirmed';

/** One difference between the standard spelling and the mushaf's. */
export interface RasmNote {
  kind: RasmKind;
  /** The letter in the standard spelling ('' when it has none). */
  standard: string;
  /** The letter in the mushaf ('' when it has none). */
  mushaf: string;
  /**
   * UTF-16 range [from, to) of WordRasm.imlaei to highlight, or null for
   * nothing to highlight (always for ziyada, wasl and fasl).
   */
  mark: [number, number] | null;
  basis: RasmBasis;
}

/** The rasm notes of one unit: a word, or the words a fasl unit covers. */
export interface WordRasm {
  source: WordStudySource;
  verseKey: string;
  /** First and last app word of the unit (equal unless fasl). */
  from: number;
  to: number;
  /** The unit's standard spelling, verbatim from the source. */
  imlaei: string;
  notes: RasmNote[];
  /** The unit is in the hand-reviewed list. */
  reviewed: boolean;
}

export interface VerseWordStudy {
  verseKey: string;
  /** Ordered by source display order, then by the entry's order. */
  gharib: GharibEntry[];
  /** Ordered by first word. */
  rasm: WordRasm[];
}

/** Stored kind codes. The build scripts write with this table too. */
export const RASM_KIND_CODE: Readonly<Record<RasmKind, string>> = {
  hadhf: 'h',
  ziyada: 'z',
  badal: 'b',
  hamz: 'm',
  wasl: 'w',
  fasl: 'f',
};

/** Stored basis codes. */
export const RASM_BASIS_CODE: Readonly<Record<RasmBasis, string>> = {
  sign: 's',
  rule: 'r',
  reviewed: 'v',
  unconfirmed: 'u',
};

const KIND_OF_CODE: ReadonlyMap<string, RasmKind> = new Map(
  (Object.entries(RASM_KIND_CODE) as [RasmKind, string][]).map(([k, c]) => [
    c,
    k,
  ]),
);
const BASIS_OF_CODE: ReadonlyMap<string, RasmBasis> = new Map(
  (Object.entries(RASM_BASIS_CODE) as [RasmBasis, string][]).map(([b, c]) => [
    c,
    b,
  ]),
);

export function emptyVerseStudy(verseKey: string): VerseWordStudy {
  return {verseKey, gharib: [], rasm: []};
}

function isOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Decodes a stored `[[code, standard, mushaf, markFrom, markTo, basis], …]`
 * row. Bad JSON gives []; rows with an unknown kind code or non-string
 * letters are skipped. A missing or unknown basis reads as unconfirmed, so
 * nothing the app does not understand is shown. A mark of -1 (or any range
 * that is not a valid non-empty range) reads as null.
 */
export function decodeRasmNotes(json: string): RasmNote[] {
  let rows: unknown;
  try {
    rows = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const out: RasmNote[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const kind = KIND_OF_CODE.get(row[0] as string);
    const standard = row[1];
    const mushaf = row[2];
    if (!kind || typeof standard !== 'string' || typeof mushaf !== 'string')
      continue;
    const from = row[3];
    const to = row[4];
    const mark: [number, number] | null =
      isOffset(from) && isOffset(to) && to > from ? [from, to] : null;
    const basis = BASIS_OF_CODE.get(row[5] as string) ?? 'unconfirmed';
    out.push({kind, standard, mushaf, mark, basis});
  }
  return out;
}

export function encodeRasmNotes(notes: readonly RasmNote[]): string {
  return JSON.stringify(
    notes.map(n => [
      RASM_KIND_CODE[n.kind],
      n.standard,
      n.mushaf,
      n.mark ? n.mark[0] : -1,
      n.mark ? n.mark[1] : -1,
      RASM_BASIS_CODE[n.basis],
    ]),
  );
}

/** Whether the app shows the note (see RasmBasis). */
export function isShownRasmNote(note: RasmNote): boolean {
  return note.basis !== 'unconfirmed';
}

/** The notes of a unit that the app shows, in stored order. */
export function shownRasmNotes(rasm: WordRasm): RasmNote[] {
  return rasm.notes.filter(isShownRasmNote);
}

/** Entries whose span covers the word. Verse-level entries are left out. */
export function gharibForWord(
  verse: VerseWordStudy,
  position: number,
): GharibEntry[] {
  return verse.gharib.filter(
    e => e.span !== null && e.span[0] <= position && position <= e.span[1],
  );
}

/** Entries placed on no word of the verse. */
export function verseLevelGharib(verse: VerseWordStudy): GharibEntry[] {
  return verse.gharib.filter(e => e.span === null);
}

/**
 * The unit holding the word, or null when there is none or when none of its
 * notes is shown (null hides the rasm section).
 */
export function rasmForWord(
  verse: VerseWordStudy,
  position: number,
): WordRasm | null {
  const unit = verse.rasm.find(u => u.from <= position && position <= u.to);
  return unit && unit.notes.some(isShownRasmNote) ? unit : null;
}
