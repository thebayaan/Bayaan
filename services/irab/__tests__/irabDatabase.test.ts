/**
 * The bundled i'rab database (assets/data/irab-v1.db): complete, well formed,
 * and holding the lines that were checked by hand. Rebuild it with
 * scripts/irab/build-irab-db.ts; a change to any line below must be a
 * reviewed correction.
 */
import path from 'path';
import Database from 'better-sqlite3';
import {
  decodeEntries,
  decodeMorph,
  MORPH_LEMMA_LABEL, // @ai
  MORPH_ROOT_LABEL, // @ai
} from '../irabFormat';

const DB = path.join(__dirname, '../../../assets/data/irab-v1.db');
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
    expect(meta.version).toBe('1');
    expect(meta.treebank).toMatch(/NoorBayan\/Quranic@[0-9a-f]{40}$/);
    expect(meta.masaq).toMatch(/sha256:[0-9a-f]{64}$/);
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

  // @ai-start
  it('writes each root as 3 or 4 spaced letters, with one root and one lemma at most', () => {
    const rows = db
      .prepare('SELECT verse_key, position, morph FROM word_irab')
      .all() as {
      verse_key: string;
      position: number;
      morph: string;
    }[];
    const bad: string[] = [];
    let roots = 0;
    for (const r of rows) {
      const facts = decodeMorph(r.morph, texts);
      const root = facts.filter(f => f.label === MORPH_ROOT_LABEL);
      const lemma = facts.filter(f => f.label === MORPH_LEMMA_LABEL);
      roots += root.length;
      if (root.length > 1 || lemma.length > 1) {
        bad.push(`${r.verse_key}:${r.position} repeats a root or lemma`);
      }
      for (const f of root) {
        if (!/^[ء-ي]( [ء-ي]){2,3}$/.test(f.value)) {
          bad.push(`${r.verse_key}:${r.position} ${f.value}`);
        }
      }
    }
    expect(bad).toEqual([]);
    expect(roots).toBeGreaterThan(0);
    expect(word('1:4:1').morph[MORPH_ROOT_LABEL]).toBe('م ل ك');
    expect(word('1:4:1').morph[MORPH_LEMMA_LABEL]).toBe('مَٰلِك');
  });
  // @ai-end
});
