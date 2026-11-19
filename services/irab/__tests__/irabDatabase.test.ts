/**
 * The bundled i'rab database (assets/data/irab-v2.db): complete, well formed,
 * and holding the lines that were checked by hand. Rebuild it with
 * scripts/irab/build-irab-db.ts; a change to any line below must be a
 * reviewed correction.
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {DB_VERSION} from '../../../scripts/irab/build-irab-db';
import {decodeEntries, decodeMorph} from '../irabFormat';

const DB = path.join(__dirname, `../../../assets/data/irab-v${DB_VERSION}.db`);
const WBW = path.join(__dirname, '../../../data/wbw/wbw-en.db');

const db = new Database(DB, {readonly: true});
const texts: string[] = [];
for (const r of db.prepare('SELECT id, text FROM texts').all() as {
  id: number;
  text: string;
}[]) {
  texts[r.id] = r.text;
}

function word(key: string) {
  const [s, a, w] = key.split(':');
  const row = db
    .prepare(
      'SELECT entries, morph FROM word_irab WHERE verse_key = ? AND position = ?',
    )
    .get(`${s}:${a}`, Number(w)) as {entries: string; morph: string};
  return {
    lines: decodeEntries(row.entries, texts)
      .filter(e => e.kind === 'stem' || e.kind === 'suffix')
      .map(e => e.text),
    morph: Object.fromEntries(
      decodeMorph(row.morph, texts).map(f => [f.label, f.value]),
    ),
  };
}

afterAll(() => db.close());

describe('completeness', () => {
  it("has every word of the app, each with i'rab and morphology", () => {
    const wbw = new Database(WBW, {readonly: true});
    const appWords = (
      wbw.prepare('SELECT COUNT(*) AS n FROM words').get() as {n: number}
    ).n;
    wbw.close();
    const rows = db.prepare('SELECT entries, morph FROM word_irab').all() as {
      entries: string;
      morph: string;
    }[];
    expect(rows).toHaveLength(appWords);
    for (const r of rows) {
      expect(decodeEntries(r.entries, texts).length).toBeGreaterThan(0);
      expect(decodeMorph(r.morph, texts).length).toBeGreaterThan(0);
    }
  });

  it('records its sources', () => {
    const meta = Object.fromEntries(
      (
        db.prepare('SELECT key, value FROM meta').all() as {
          key: string;
          value: string;
        }[]
      ).map(r => [r.key, r.value]),
    );
    expect(meta.version).toBe(String(DB_VERSION));
    expect(meta.treebank).toMatch(/NoorBayan\/Quranic@[0-9a-f]{40}$/);
    expect(meta.masaq).toMatch(/sha256:[0-9a-f]{64}$/);
    expect(meta.masaq).toContain(
      'https://creativecommons.org/licenses/by/4.0/',
    );
  });

  it('keeps the notices its licences ask derived files to keep', () => {
    const notice = (key: string) =>
      (
        db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
          | {value: string}
          | undefined
      )?.value;
    const file = (name: string) =>
      fs.readFileSync(path.join(__dirname, '../../../licenses', name), 'utf8');
    expect(notice('qac_notice')).toBe(file('quranic-arabic-corpus-notice.txt'));
    expect(notice('treebank_notice')).toBe(file('NoorBayan-Quranic-MIT.txt'));
  });
});

describe('book passages', () => {
  const passages = db
    .prepare('SELECT id, book_id, part, page, text FROM passages')
    .all() as {
    id: number;
    book_id: number;
    part: string;
    page: string;
    text: string;
  }[];
  const forVerse = (verseKey: string, bookId: number) =>
    db
      .prepare(
        `SELECT p.part || '/' || p.page AS page, p.text FROM verse_passages v
           JOIN passages p ON p.id = v.passage_id
          WHERE v.verse_key = ? AND v.book_id = ? ORDER BY v.ord`,
      )
      .all(verseKey, bookId) as {page: string; text: string}[];

  it('hold no control character but the line break', () => {
    // eslint-disable-next-line no-control-regex
    const bad = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/;
    expect(passages.filter(p => bad.test(p.text)).map(p => p.id)).toEqual([]);
  });

  it("show al-Nahhas without his modern editor's footnotes or note markers", () => {
    const nahhas = passages.filter(p => p.book_id === 318);
    expect(nahhas.length).toBeGreaterThan(1300);
    // The editor's notes cite works written centuries after al-Nahhas
    // (d. 338 AH); his own text never does.
    const notes =
      /«[٠-٩0-9]+»|البحر المحيط|خزانة الأدب|تاج العروس|تيسير الداني|ترجمته في/;
    expect(nahhas.filter(p => notes.test(p.text)).map(p => p.id)).toEqual([]);

    const opening = forVerse('1:1', 318);
    expect(opening[0].page).toBe('1/13');
    expect(opening[0].text).toContain(
      'حدّثنا أبو الحسن أحمد بن سعيد الدّمشقي عن عبد الخالق عن أبي عبيد قال:',
    );
    expect(opening[0].text.endsWith('وكسرت الباء ليفرّق بين ما')).toBe(true);
    // A line of al-Nahhas that starts with a verse number stays.
    expect(passages.some(p => p.text.includes('\n(١٣) فأمسكت على فيه،'))).toBe(
      true,
    );
  });

  it("start surah 114 with al-Nahhas, not the publisher's introduction", () => {
    expect(passages.filter(p => p.text.includes('كلام الناشر'))).toEqual([]);
    for (const vk of ['114:1', '114:6']) {
      expect(forVerse(vk, 318).map(p => p.page)).toEqual(['5/199', '5/200']);
    }
  });

  it('put a surah heading on its own line', () => {
    // al-Ukbari's title of al-Fatiha, then the basmala on the next line.
    const [title, basmala] = forVerse('1:2', 309)[0].text.split('\n');
    expect(title).toBe('سُورَةُ الْفَاتِحَةِ');
    expect(basmala.startsWith('بِسم الله ')).toBe(true);
  });
});

describe('texts', () => {
  it('hold no Latin letters, replacement characters or markup', () => {
    for (const t of texts) {
      expect(t).not.toMatch(/[A-Za-z<>�]/);
    }
  });

  it('never keep a sign tail without its sign', () => {
    for (const t of texts) {
      if (/منع من ظهورها/.test(t)) expect(t).toMatch(/وعلامة/);
    }
  });

  it('refer only to words that exist', () => {
    const keys = new Set(
      (
        db.prepare('SELECT verse_key, position FROM word_irab').all() as {
          verse_key: string;
          position: number;
        }[]
      ).map(r => `${r.verse_key}:${r.position}`),
    );
    const rows = db
      .prepare('SELECT verse_key, entries, morph FROM word_irab')
      .all() as {
      verse_key: string;
      entries: string;
      morph: string;
    }[];
    for (const r of rows) {
      const all = [
        ...decodeEntries(r.entries, texts).map(e => e.text),
        ...decodeMorph(r.morph, texts).map(f => f.value),
      ].join(' ');
      for (const m of all.matchAll(/\{\{(?:(\d+):(\d+):)?(\d+)\}\}/g)) {
        const key = m[1] ? `${m[1]}:${m[2]}:${m[3]}` : `${r.verse_key}:${m[3]}`;
        expect(keys.has(key)).toBe(true);
      }
    }
  });
});

describe('reviewed lines', () => {
  it.each([
    ['1:1:1', 'اسم مجرور بالباء وعلامة جره الكسرة'],
    ['1:2:1', 'مبتدأ مرفوع وعلامة رفعه الضمة'],
    ['1:2:4', 'مضاف إليه مجرور وعلامة جره الياء لأنه ملحق بجمع المذكر السالم'],
    // Dotless final ya (تَجْرِى) is a ya.
    ['2:25:9', 'فعل مضارع مرفوع وعلامة رفعه الضمة المقدرة على الياء للثقل'],
    // A single proper-name vocative is built on damm.
    ['5:22:2', 'منادى مبني على الضم المقدر على الألف للتعذر في محل نصب'],
    ['109:1:2', 'منادى نكرة مقصودة مبني على الضم في محل نصب، و«ها» حرف تنبيه'],
    // The written nun keeps the five verbs marfu' (لا تظلمون).
    [
      '2:272:28',
      'فعل مضارع مبني للمجهول مرفوع وعلامة رفعه ثبوت النون لأنه من الأفعال الخمسة',
    ],
    // No ناصب before لا يخفى.
    ['3:5:4', 'فعل مضارع مرفوع وعلامة رفعه الضمة المقدرة على الألف للتعذر'],
    ['111:1:3', 'مضاف إليه مجرور وعلامة جره الياء لأنه من الأسماء الخمسة'],
    ['5:106:42', 'خبر {{41}} منصوب وعلامة نصبه الألف لأنه من الأسماء الخمسة'],
    ['3:52:12', 'فاعل مرفوع وعلامة رفعه الواو لأنه جمع مذكر سالم'],
    // A broken plural whose ن is the root's own.
    ['10:13:3', 'مفعول به منصوب وعلامة نصبه الفتحة'],
    ['11:40:13', 'توكيد لـ{{12}} منصوب وعلامة نصبه الياء لأنه مثنى'],
    [
      '2:2:3',
      'لا النافية للجنس مبنية على السكون لا محل لها من الإعراب، تعمل عمل إنّ',
    ],
  ])('%s', (key, line) => {
    expect(word(key).lines[0]).toBe(line);
  });

  it('vocative رَبِّ with both يا and the ياء المتكلم dropped (11:47)', () => {
    expect(word('11:47:2').lines[0]).toMatch(
      /^منادى منصوب وعلامة نصبه الفتحة المقدرة على ما قبل ياء المتكلم/,
    );
  });

  it('splits off the ياء المتكلم the treebank misses (26:86 لِأَبِىٓ)', () => {
    expect(word('26:86:2').lines).toEqual([
      'اسم مجرور باللام وعلامة جره الكسرة المقدرة على ما قبل ياء المتكلم، منع من ظهورها اشتغال المحل بالحركة المناسبة',
      'ضمير متصل مبني على السكون في محل جر مضاف إليه',
    ]);
  });
});

describe('morphology', () => {
  it('نَسْتَعِينُ (1:5:4)', () => {
    expect(word('1:5:4').morph).toMatchObject({
      'نوع الكلمة': 'فعل مضارع',
      الجذر: 'ع و ن',
      'نوع الفعل': 'معتل أجوف واوي',
      الوزن: 'ثلاثي مزيد بثلاثة أحرف على وزن «اِسْتَفْعَلَ»',
      البناء: 'مبني للمعلوم',
      التعدي: 'متعدٍّ، ومفعوله {{3}}',
    });
  });

  it('مَـٰلِكِ (1:4:1)', () => {
    expect(word('1:4:1').morph).toMatchObject({
      'نوع الكلمة': 'اسم فاعل',
      الاشتقاق: 'اسم فاعل من الفعل الثلاثي المجرد',
      'العدد والجنس': 'مفرد مذكر',
      التعريف: 'معرفة بالإضافة',
    });
  });

  it('plural types', () => {
    expect(word('1:2:4').morph['العدد والجنس']).toBe('ملحق بجمع المذكر السالم');
    expect(word('2:25:5').morph['العدد والجنس']).toBe('جمع مؤنث سالم');
    expect(word('3:52:12').morph['العدد والجنس']).toBe('جمع مذكر سالم');
    expect(word('10:13:3').morph['العدد والجنس']).toBe('جمع تكسير');
  });
});
