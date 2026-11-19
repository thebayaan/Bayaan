// @ai-generated
/**
 * The bundled gharib database (assets/data/gharib-v1.db): complete, well
 * formed, and holding the placements checked by hand. Rebuild it with
 * scripts/word-study/build-gharib-db.ts and compare with --check; a change
 * to any line below must be a reviewed correction.
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import lock from '../../../scripts/word-study/sources.lock.json';

const ROOT = path.join(__dirname, '../../..');
const DB = path.join(__dirname, '../../../assets/data/gharib-v1.db');
const WBW = path.join(__dirname, '../../../data/wbw/wbw-en.db');

const db = new Database(DB, {readonly: true});
afterAll(() => db.close());

interface Row {
  verse_key: string;
  ord: number;
  word_from: number | null;
  word_to: number | null;
  tier: number;
  candidate: string;
  headword: string;
  gloss: string;
}

const rows = db
  .prepare(
    `SELECT g.verse_key, g.ord, g.word_from, g.word_to, g.tier, g.candidate,
            h.text AS headword, x.text AS gloss
       FROM gharib g
       JOIN texts h ON h.id = g.headword_id
       JOIN texts x ON x.id = g.gloss_id
      WHERE g.source_id = 327`,
  )
  .all() as Row[];

/**
 * The entry with this headword. Compared in NFC: the book writes shadda
 * before fatha, a test file may hold the canonical order; the stored text
 * stays as the book has it.
 */
function placed(verseKey: string, headword: string): Row | undefined {
  const want = headword.normalize('NFC');
  return rows.find(
    r => r.verse_key === verseKey && r.headword.normalize('NFC') === want,
  );
}

describe('provenance', () => {
  const meta = Object.fromEntries(
    (
      db.prepare('SELECT key, value FROM meta').all() as {
        key: string;
        value: string;
      }[]
    ).map(r => [r.key, r.value]),
  );
  const input = lock.gharib[0];

  it('records the locked input, its version and the credit', () => {
    expect(meta.format).toBe('1');
    expect(meta.kind).toBe('gharib');
    expect(meta['input_meanings.json.gz_sha256']).toBe(input.sha256);
    expect(meta['input_meanings.json.gz_url']).toBe(input.downloadUrl);
    expect(meta.source_327_version).toBe(input.version);
    expect(meta.source_327_credit).toBe(
      `Quranpedia (quranpedia.net), https://quranpedia.net, version ${input.version}`,
    );
    expect(meta.app_words).toBe('77429');
  });

  it('names the book as the lock does', () => {
    const book = input.books[0];
    expect(db.prepare('SELECT * FROM sources').all()).toEqual([
      {
        id: 327,
        ord: book.ord,
        name_ar: book.nameAr,
        name_en: book.nameEn,
        author_ar: book.authorAr,
        author_en: book.authorEn,
        via_ar: book.viaAr,
        via_en: book.viaEn,
        url: book.url,
        version: input.version,
      },
    ]);
  });
});

describe('completeness', () => {
  it('pins the counts per tier', () => {
    const count = (tier: number) => rows.filter(r => r.tier === tier).length;
    expect(rows).toHaveLength(2746);
    expect(rows.filter(r => r.word_from !== null)).toHaveLength(2694);
    expect([0, 1, 2, 3, 4, 5].map(count)).toEqual([40, 2484, 40, 171, 10, 1]);
  });

  it('records its counts in meta, and the docs give the same', () => {
    // A rebuild that changes how many entries go on words must update the
    // docs that give the number.
    const meta = (key: string) =>
      Number(
        (
          db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as {
            value: string;
          }
        ).value,
      );
    const onWords = meta('source_327_placed');
    const entries = meta('source_327_entries');
    expect(onWords).toBe(rows.filter(r => r.word_from !== null).length);
    expect(entries).toBe(rows.length);
    const n = (count: number) => count.toLocaleString('en-US');
    const doc = (file: string) =>
      fs.readFileSync(path.join(ROOT, file), 'utf8');
    expect(doc('scripts/word-study/SOURCES.md')).toContain(
      `${n(onWords)} of ${n(entries)} entries`,
    );
    expect(doc('docs/research/surah-app-feature-gaps.md')).toContain(
      `${n(onWords)} entries placed on words`,
    );
  });

  it('puts every span on words of the app', () => {
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
      if (r.word_from === null || r.word_to === null) continue;
      expect(r.word_to).toBeGreaterThanOrEqual(r.word_from);
      for (let w = r.word_from; w <= r.word_to; w++) {
        expect(words.has(`${r.verse_key}:${w}`)).toBe(true);
      }
    }
  });

  it('keeps tier 4 and neighbouring-verse matches at verse level', () => {
    const kind = (r: Row) => {
      const own = r.candidate.startsWith(`${r.verse_key}:`);
      if (r.word_from !== null) {
        return r.candidate === '' && [1, 2, 3, 5].includes(r.tier)
          ? 'on words'
          : 'bad';
      }
      if (r.tier === 0 && r.candidate === '') return 'none';
      if (r.tier === 4 && own) return 'loose';
      if ([1, 2, 3].includes(r.tier) && r.candidate && !own) return 'moved';
      if (r.tier === 5 && r.candidate === '') return 'reviewed';
      return 'bad';
    };
    const kinds = rows.map(kind);
    expect(kinds.filter(k => k === 'bad')).toEqual([]);
    expect(kinds.filter(k => k === 'loose')).toHaveLength(10);
    expect(kinds.filter(k => k === 'moved')).toHaveLength(1);
    expect(kinds.filter(k => k === 'reviewed')).toHaveLength(1);
    expect(placed('69:11', 'لَمَّا طَغَى الْماءُ')).toMatchObject({
      tier: 4,
      word_from: null,
      candidate: '69:11:2-4',
    });
  });
});

describe('texts', () => {
  const texts = (
    db.prepare('SELECT text FROM texts').all() as {text: string}[]
  ).map(r => r.text);

  it('hold no markup, link, Latin letter, digit, bracket or U+FFFD', () => {
    for (const t of texts) {
      expect(t).not.toMatch(/[<>A-Za-z0-9٠-٩[\]�]|https?:|www\./);
    }
  });

  it('keep the words the edition restored in brackets, without the brackets', () => {
    // «… أو أتلو [أو قرأت]  .» in the dump.
    expect(placed('1:1', 'بِسْمِ اللَّهِ')?.gloss).toMatch(
      /أو أتلو أو قرأت\.$/,
    );
    // «الراحم  [والرّحمة]  تظهر في القلب، …»
    expect(placed('1:1', 'الرَّحِيمِ')?.gloss).toMatch(
      /^الراحم والرّحمة تظهر في القلب، /,
    );
    // «[ألّا]  تجوروا وتميلوا. …»: without its first word the gloss says
    // the opposite.
    expect(placed('4:3', 'أَلَّا تَعُولُوا')?.gloss).toMatch(
      /^ألّا تجوروا وتميلوا\. /,
    );
    // «… وقيل: واسع [الرحمة، ولذلك رخّص في] الشريعة.»
    expect(placed('2:115', 'واسِعٌ')?.gloss).toMatch(
      /وقيل: واسع الرحمة، ولذلك رخّص في الشريعة\.$/,
    );
  });

  it('lost the apparatus: the source siglum [زه] and verse numbers', () => {
    // «… ممن يعول قوما [زه] والأول قول الجمهور …» in the dump.
    expect(placed('4:3', 'أَلَّا تَعُولُوا')?.gloss).toContain(
      'ممن يعول قوما والأول قول الجمهور',
    );
    // «… ومنه تُراوِدُ فَتاها عَنْ نَفْسِهِ [30] : أي عبدها.»
    expect(placed('12:36', 'فَتَيانِ')?.gloss).toMatch(
      /ومنه تُراوِدُ فَتاها عَنْ نَفْسِهِ: أي عبدها\.$/,
    );
    for (const t of texts) expect(t).not.toMatch(/(^|[\s.،:])زه($|[\s.،:])/);
  });
});

describe('glosses on words', () => {
  it('read as a meaning: an Arabic letter, no cut start or end', () => {
    for (const r of rows) {
      if (r.word_from === null) continue;
      expect(r.gloss).toMatch(/[ء-ي]/);
      expect(r.gloss).not.toMatch(/^[:،]|[:،]$/);
    }
  });

  it('leave out the two that do not, kept at verse level', () => {
    // The book's entry is a lone «.».
    expect(placed('86:15', 'يَكِيدُونَ كَيْداً')).toMatchObject({
      gloss: '.',
      tier: 0,
      word_from: null,
    });
    // As printed: «… واحدها كفت [ثم قال]  :», a lead-in to the next entry.
    // gharib-reviewed.json keeps it at verse level.
    expect(placed('77:25', 'كِفاتاً')).toMatchObject({
      gloss: 'أوعية، واحدها كفت ثم قال:',
      tier: 5,
      word_from: null,
    });
  });
});

describe('reviewed placements', () => {
  it.each([
    ['1:1', 'بِسْمِ اللَّهِ', 1, 2],
    ['1:4', 'الدِّينِ', 3, 3],
    ['1:7', 'الْمَغْضُوبِ عَلَيْهِمْ', 6, 7],
    ['2:2', 'لا رَيْبَ فِيهِ', 3, 5],
    ['2:2', 'هُدىً', 6, 6],
    ['2:2', 'لِلْمُتَّقِينَ', 7, 7],
    ['2:3', 'وَيُقِيمُونَ الصَّلاةَ', 4, 5],
    // The span keeps the لا of the book's phrase.
    ['2:48', 'لا تَجْزِي نَفْسٌ عَنْ نَفْسٍ شَيْئاً', 3, 8],
    // The noun ثَمَرِهِ, not the verb أَثْمَرَ (word 37).
    ['6:99', 'ثمر', 35, 35],
    // A seatless hamza and a conjunction (tier 3).
    ['10:53', 'يَسْتَنْبِئُونَكَ', 1, 1],
    // The article's merged lam (ٱلَّيْلِ).
    [
      '3:27',
      'تُولِجُ اللَّيْلَ فِي النَّهارِ وَتُولِجُ النَّهارَ فِي اللَّيْلِ',
      1,
      8,
    ],
    // The nouns, not «وَلَا» before them (tier 3, the article taken off).
    // With every alif dropped, «وَلَا سَآئِبَةٍ» spells والسائبة at tier 2.
    ['5:103', 'والسائبة', 7, 7],
    ['5:103', 'والوصيلة', 9, 9],
    ['5:103', 'والحامي', 11, 11],
  ])('%s «%s» on words %i-%i', (verseKey, headword, from, to) => {
    expect(placed(verseKey, headword)).toMatchObject({
      word_from: from,
      word_to: to,
    });
  });
});
