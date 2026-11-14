// @ai-generated
import {
  decodeRasmNotes,
  emptyVerseStudy,
  encodeRasmNotes,
  gharibForWord,
  isShownRasmNote,
  rasmForWord,
  shownRasmNotes,
  verseLevelGharib,
  type GharibEntry,
  type RasmNote,
  type VerseWordStudy,
  type WordRasm,
  type WordStudySource,
} from '../wordStudyFormat';

const BOOK: WordStudySource = {
  id: 9,
  kind: 'gharib',
  ord: 1,
  nameAr: 'كتاب',
  nameEn: 'Book',
  authorAr: 'مؤلف',
  authorEn: 'Author',
  viaAr: 'ناشر',
  viaEn: 'Publisher',
  url: 'https://example.org',
  version: '1',
};
const TEXT: WordStudySource = {...BOOK, id: 1, kind: 'rasm'};

function entry(ord: number, span: [number, number] | null): GharibEntry {
  return {
    source: BOOK,
    verseKey: '2:2',
    ord,
    span,
    headword: 'كلمة',
    gloss: 'شرح',
    note: '',
    part: '',
    page: '',
  };
}

function unit(from: number, to: number, notes: RasmNote[]): WordRasm {
  return {
    source: TEXT,
    verseKey: '2:2',
    from,
    to,
    imlaei: 'كلمة',
    notes,
    reviewed: false,
  };
}

const hadhf: RasmNote = {
  kind: 'hadhf',
  standard: 'ا',
  mushaf: '',
  mark: [2, 4],
  basis: 'sign',
};

describe('rasm notes encoding', () => {
  it('round-trips every kind and basis', () => {
    const notes: RasmNote[] = [
      hadhf,
      {kind: 'ziyada', standard: '', mushaf: 'ا', mark: null, basis: 'sign'},
      {kind: 'badal', standard: 'ا', mushaf: 'و', mark: [5, 7], basis: 'rule'},
      {kind: 'hamz', standard: 'ئ', mushaf: 'ء', mark: [1, 3], basis: 'sign'},
      {kind: 'wasl', standard: '', mushaf: '', mark: null, basis: 'reviewed'},
      {
        kind: 'fasl',
        standard: '',
        mushaf: '',
        mark: null,
        basis: 'unconfirmed',
      },
    ];
    expect(decodeRasmNotes(encodeRasmNotes(notes))).toEqual(notes);
  });

  it('stores -1 for no mark', () => {
    const json = encodeRasmNotes([{...hadhf, mark: null}]);
    expect(JSON.parse(json)).toEqual([['h', 'ا', '', -1, -1, 's']]);
    expect(decodeRasmNotes(json)[0].mark).toBeNull();
  });

  it('skips bad JSON, unknown codes and malformed rows', () => {
    expect(decodeRasmNotes('not json')).toEqual([]);
    expect(decodeRasmNotes('{"a":1}')).toEqual([]);
    expect(decodeRasmNotes('[["q","ا","",-1,-1,"s"]]')).toEqual([]);
    expect(
      decodeRasmNotes('[["h",1,"",-1,-1,"s"],"x",["b","ا","و",0,2,"s"]]'),
    ).toEqual([
      {kind: 'badal', standard: 'ا', mushaf: 'و', mark: [0, 2], basis: 'sign'},
    ]);
  });

  it('reads an invalid range as no mark', () => {
    for (const [from, to] of [
      [-1, 2],
      [3, 3],
      [4, 2],
      [1.5, 2],
    ]) {
      const json = JSON.stringify([['h', 'ا', '', from, to, 's']]);
      expect(decodeRasmNotes(json)[0].mark).toBeNull();
    }
  });

  it('reads a missing or unknown basis as unconfirmed (hidden)', () => {
    const notes = decodeRasmNotes('[["h","ا","",0,2],["h","ا","",0,2,"?"]]');
    expect(notes.map(n => n.basis)).toEqual(['unconfirmed', 'unconfirmed']);
    expect(notes.some(isShownRasmNote)).toBe(false);
  });
});

describe('gharibForWord', () => {
  const verse: VerseWordStudy = {
    ...emptyVerseStudy('2:2'),
    gharib: [entry(1, [3, 5]), entry(2, null), entry(3, [4, 4])],
  };

  it('covers the span edges and nothing outside', () => {
    expect(gharibForWord(verse, 2)).toEqual([]);
    expect(gharibForWord(verse, 3).map(e => e.ord)).toEqual([1]);
    expect(gharibForWord(verse, 4).map(e => e.ord)).toEqual([1, 3]);
    expect(gharibForWord(verse, 5).map(e => e.ord)).toEqual([1]);
    expect(gharibForWord(verse, 6)).toEqual([]);
  });

  it('leaves verse-level entries out; verseLevelGharib has them', () => {
    for (let p = 1; p <= 7; p++) {
      expect(gharibForWord(verse, p).some(e => e.span === null)).toBe(false);
    }
    expect(verseLevelGharib(verse).map(e => e.ord)).toEqual([2]);
  });
});

describe('rasmForWord', () => {
  it('finds a fasl unit from both of its words', () => {
    const fasl = unit(3, 4, [
      {kind: 'fasl', standard: '', mushaf: '', mark: null, basis: 'sign'},
    ]);
    const verse = {
      ...emptyVerseStudy('2:2'),
      rasm: [unit(1, 1, [hadhf]), fasl],
    };
    expect(rasmForWord(verse, 1)?.from).toBe(1);
    expect(rasmForWord(verse, 2)).toBeNull();
    expect(rasmForWord(verse, 3)).toBe(fasl);
    expect(rasmForWord(verse, 4)).toBe(fasl);
    expect(rasmForWord(verse, 5)).toBeNull();
  });

  it('is null when no note of the unit is shown', () => {
    const hidden = unit(2, 2, [{...hadhf, basis: 'unconfirmed'}]);
    const verse = {...emptyVerseStudy('2:2'), rasm: [hidden]};
    expect(rasmForWord(verse, 2)).toBeNull();
  });

  it('keeps a unit with one shown note; shownRasmNotes drops the rest', () => {
    const mixed = unit(2, 2, [
      {...hadhf, basis: 'unconfirmed'},
      {...hadhf, basis: 'rule'},
    ]);
    const verse = {...emptyVerseStudy('2:2'), rasm: [mixed]};
    expect(rasmForWord(verse, 2)).toBe(mixed);
    expect(shownRasmNotes(mixed).map(n => n.basis)).toEqual(['rule']);
  });
});

it('emptyVerseStudy has no entries', () => {
  expect(emptyVerseStudy('1:1')).toEqual({
    verseKey: '1:1',
    gharib: [],
    rasm: [],
  });
});
