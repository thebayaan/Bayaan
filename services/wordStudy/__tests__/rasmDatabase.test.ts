// @ai-generated
/**
 * The bundled rasm database (assets/data/rasm-v1.db): complete, well formed,
 * carrying Tanzil's notice, and holding the notes checked by hand. Rebuild
 * it with scripts/word-study/build-rasm-db.ts and compare with --check; a
 * change to any line below must be a reviewed correction.
 */
import path from 'path';
import Database from 'better-sqlite3';
import lock from '../../../scripts/word-study/sources.lock.json';
import {
  decodeRasmNotes,
  isShownRasmNote,
  type RasmNote,
} from '../wordStudyFormat';

const DB = path.join(__dirname, '../../../assets/data/rasm-v1.db');
const WBW = path.join(__dirname, '../../../data/wbw/wbw-en.db');

const db = new Database(DB, {readonly: true});
afterAll(() => db.close());

interface Row {
  verse_key: string;
  word_from: number;
  word_to: number;
  imlaei: string;
  notes: string;
  reviewed: number;
}

const rows = db.prepare('SELECT * FROM rasm').all() as Row[];
const meta = Object.fromEntries(
  (
    db.prepare('SELECT key, value FROM meta').all() as {
      key: string;
      value: string;
    }[]
  ).map(r => [r.key, r.value]),
);

/**
 * A unit as "kind standard→mushaf basis [marked]" lines. Compared in NFC:
 * Tanzil writes shadda before fatha, a test file may hold the canonical
 * order; the stored text stays as Tanzil has it.
 */
function unit(key: string): {imlaei: string; notes: string[]} | null {
  const [s, a, w] = key.split(':');
  const row = rows.find(
    r => r.verse_key === `${s}:${a}` && r.word_from === Number(w),
  );
  if (!row) return null;
  return {
    imlaei: row.imlaei.normalize('NFC'),
    notes: decodeRasmNotes(row.notes).map(n =>
      describe_(n, row.imlaei).normalize('NFC'),
    ),
  };
}

/** "kind standard→mushaf basis [marked]" */
function describe_(n: RasmNote, imlaei: string): string {
  const mark = n.mark ? ` [${imlaei.slice(n.mark[0], n.mark[1])}]` : '';
  return `${n.kind} ${n.standard}→${n.mushaf} ${n.basis}${mark}`;
}

describe('provenance', () => {
  it('records the locked input', () => {
    expect(meta.format).toBe('1');
    expect(meta.kind).toBe('rasm');
    expect(meta.source_id).toBe(String(lock.rasm.id));
    expect(meta.input_sha256).toBe(lock.rasm.sha256);
    expect(meta.input_url).toBe(lock.rasm.downloadUrl);
    expect(meta.version).toBe(lock.rasm.version);
    expect(meta.app_words).toBe('77429');
  });

  it('keeps Tanzil’s copyright block verbatim', () => {
    const lines = meta.notice.split('\n');
    expect(lines[0]).toBe(
      '# PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK',
    );
    expect(lines).toHaveLength(28);
    expect(lines.every(l => l.startsWith('#'))).toBe(true);
    expect(meta.notice).toContain('#  Tanzil Quran Text (Simple, Version 1.1)');
    expect(meta.notice).toContain(
      '#  License: Creative Commons Attribution 3.0',
    );
    expect(meta.notice).toContain(
      '#    of this text, but CHANGING IT IS NOT ALLOWED.',
    );
    expect(meta.notice).toContain(
      '#  Please check updates at: http://tanzil.net/updates/',
    );
  });

  it('names the source as the lock does', () => {
    const r = lock.rasm;
    expect(db.prepare('SELECT * FROM sources').all()).toEqual([
      {
        id: r.id,
        ord: r.ord,
        name_ar: r.nameAr,
        name_en: r.nameEn,
        author_ar: r.authorAr,
        author_en: r.authorEn,
        via_ar: r.viaAr,
        via_en: r.viaEn,
        url: r.url,
        version: r.version,
      },
    ]);
  });
});

describe('completeness', () => {
  const notes = rows.flatMap(r => decodeRasmNotes(r.notes));

  it('pins the counts', () => {
    expect(rows).toHaveLength(6913);
    expect(
      rows.filter(r => decodeRasmNotes(r.notes).some(isShownRasmNote)),
    ).toHaveLength(6900);
    const by = (kind: string, basis: string) =>
      notes.filter(n => n.kind === kind && n.basis === basis).length;
    expect({
      hadhfSign: by('hadhf', 'sign'),
      hadhfRule: by('hadhf', 'rule'),
      hadhfHidden: by('hadhf', 'unconfirmed'),
      badalSign: by('badal', 'sign'),
      badalHidden: by('badal', 'unconfirmed'),
      hamzSign: by('hamz', 'sign'),
      hamzHidden: by('hamz', 'unconfirmed'),
      ziyadaSign: by('ziyada', 'sign'),
      waslRule: by('wasl', 'rule'),
      waslHidden: by('wasl', 'unconfirmed'),
      fasl: notes.filter(n => n.kind === 'fasl').length,
      reviewed: notes.filter(n => n.basis === 'reviewed').length,
    }).toEqual({
      hadhfSign: 6083,
      hadhfRule: 118,
      hadhfHidden: 19,
      badalSign: 523,
      badalHidden: 20,
      hamzSign: 548,
      hamzHidden: 10,
      ziyadaSign: 155,
      waslRule: 365,
      waslHidden: 1,
      fasl: 0,
      reviewed: 0,
    });
    expect(meta.notes_unconfirmed).toBe('50');
  });

  it('keys every unit to one word of the app', () => {
    const wbw = new Database(WBW, {readonly: true});
    const words = new Set(
      (
        wbw.prepare('SELECT verse_key, position FROM words').all() as {
          verse_key: string;
          position: number;
        }[]
      ).map(w => `${w.verse_key}:${w.position}`),
    );
    wbw.close();
    for (const r of rows) {
      expect(r.word_to).toBe(r.word_from);
      expect(words.has(`${r.verse_key}:${r.word_from}`)).toBe(true);
      expect(r.reviewed).toBe(0);
    }
  });
});

describe('well formed', () => {
  it('stores the standard spelling as Tanzil writes it', () => {
    // Letters, harakat, the dagger alif and spaces; nothing else.
    for (const r of rows) {
      expect(r.imlaei).toMatch(/^[ء-غف-ْٰ ]+$/);
    }
  });

  it('marks letters of the standard spelling and uses display letters', () => {
    const letters = new Set([...'اوىيءأإآؤئةتسصنل', '']);
    for (const r of rows) {
      const decoded = decodeRasmNotes(r.notes);
      expect(decoded.length).toBeGreaterThan(0);
      for (const n of decoded) {
        expect(letters.has(n.standard)).toBe(true);
        expect(letters.has(n.mushaf)).toBe(true);
        if (n.mark) {
          expect(n.mark[1]).toBeLessThanOrEqual(r.imlaei.length);
          expect(r.imlaei.slice(n.mark[0], n.mark[1])).toMatch(/[ء-ي]/);
        }
      }
    }
  });
});

describe('reviewed lines', () => {
  it.each([
    ['1:4:1', 'مَالِكِ', ['hadhf ا→ sign [ا]']],
    ['2:3:5', 'الصَّلَاةَ', ['badal ا→و sign [ا]']],
    // The و has a vowel of its own: hadhf, not badal.
    ['2:25:30', 'أَزْوَاجٌ', ['hadhf ا→ sign [ا]']],
    ['2:124:3', 'إِبْرَاهِيمَ', ['hadhf ا→ sign [ا]', 'hadhf ي→ sign [ي]']],
    ['2:245:14', 'وَيَبْسُطُ', ['badal س→ص sign [سُ]']],
    ['21:88:7', 'نُنجِي', ['hadhf ن→ sign [ن]']],
    ['2:275:3', 'الرِّبَا', ['badal ا→و sign [ا]', 'ziyada →ا sign']],
    ['18:23:3', 'لِشَيْءٍ', ['ziyada →ا sign']],
    ['2:14:16', 'مُسْتَهْزِئُونَ', ['hamz ئ→ء sign [ئُ]']],
    ['2:21:1', 'يَا أَيُّهَا', ['hadhf ا→ sign [ا]', 'wasl → rule']],
    ['2:164:7', 'اللَّيْلِ', ['hadhf ل→ rule [ل]']],
    ['2:226:9', 'فَاءُوا', ['hadhf ا→ rule [ا]']],
    // Derived but hidden until reviewed.
    ['12:25:9', 'لَدَى', ['badal ى→ا unconfirmed [ى]']],
    [
      '72:16:1',
      'وَأَن لَّوِ',
      ['hadhf ن→ unconfirmed [ن]', 'wasl → unconfirmed'],
    ],
  ])('%s %s', (key, imlaei, notes) => {
    expect(unit(key)).toEqual({
      imlaei: imlaei.normalize('NFC'),
      notes: notes.map(n => n.normalize('NFC')),
    });
  });

  it.each([
    // Only the hamza form differs (ءَا = آ).
    '2:9:4',
    // The standard text keeps the dagger alif too.
    '2:2:1',
    // Two written words in one app position, two tokens in the standard.
    '2:181:3',
    // The stray space of wbw-en.db is not a fasl.
    '5:52:12',
  ])('no row for %s', key => {
    expect(unit(key)).toBeNull();
  });
});
