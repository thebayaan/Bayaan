// services/adhkar/__tests__/adhkarSeed.test.ts
// Assertions on the committed data/adhkar.json. The file is written by
// scripts/adhkar-content/apply-content-fixes.ts; never hand-edit it.
import fs from 'fs';
import path from 'path';
import adhkarSeed from '@/data/adhkar.json';
import {
  EVENING_TEXTS_DOC,
  parseEveningRows,
} from '@/scripts/adhkar-content/eveningRows';
import {TRANSLITERATIONS} from '@/scripts/adhkar-content/textPolish';
import {tasbeehDisplayText} from '@/services/widgets/dhikrText';

const root = path.resolve(__dirname, '../../..');
const rows = adhkarSeed.adhkar;
const byId = new Map(rows.map(r => [r.id, r]));

function row(id: string): (typeof rows)[number] {
  const found = byId.get(id);
  if (!found) throw new Error(`missing dhikr ${id}`);
  return found;
}

function range(prefix: string, from: number, to: number): string[] {
  return Array.from({length: to - from + 1}, (_, i) => `${prefix}${from + i}`);
}

const LEGACY_IDS = [
  ...range('', 1, 267),
  ...range('quranic-', 1, 40),
  ...range('name-', 1, 99),
];
const EVENING_IDS = [
  'evening-77',
  'evening-78',
  'evening-80',
  'evening-81',
  'evening-89',
  'evening-90',
];
const MORNING = [
  '75',
  '76',
  '77',
  '78',
  '79',
  '80',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '89',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '96',
  '98',
];
const EVENING = [
  '75',
  '76',
  'evening-77',
  'evening-78',
  '79',
  'evening-80',
  'evening-81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  'evening-89',
  'evening-90',
  '91',
  '92',
  '96',
  '97',
  '98',
];

describe('dhikr ids', () => {
  it('keeps every pre-existing id and adds only the six evening rows', () => {
    const ids = rows.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...LEGACY_IDS, ...EVENING_IDS].sort());
  });

  it('keeps each category dhikr_count equal to its rows', () => {
    for (const category of adhkarSeed.categories) {
      expect({
        id: category.id,
        count: rows.filter(r => r.category_id === category.id).length,
      }).toEqual({id: category.id, count: category.dhikr_count});
    }
  });
});

describe('morning and evening lists', () => {
  const lists = adhkarSeed.super_category_dhikr_ids;

  it('lists the morning adhkar without evening-only ones', () => {
    expect(lists['morning-adhkar']).toEqual(MORNING);
  });

  it('lists the evening adhkar with evening wording and without morning-only ones', () => {
    expect(lists['evening-adhkar']).toEqual(EVENING);
  });

  it('only lists ids that exist', () => {
    for (const id of [...MORNING, ...EVENING]) expect(byId.has(id)).toBe(true);
  });
});

describe('evening rows', () => {
  const reviewed = parseEveningRows(
    fs.readFileSync(path.join(root, EVENING_TEXTS_DOC), 'utf8'),
  );

  // Transliterations come from the sourced input (translit.json), which
  // replaces the spec document's values.
  it('match the reviewed spec document, with transliterations from translit.json', () => {
    expect(reviewed).toHaveLength(6);
    reviewed.forEach((spec, index) => {
      const r = row(spec.id);
      expect(r).toEqual({
        id: spec.id,
        category_id: '27',
        category_name: 'Words of remembrance for morning and evening',
        arabic: `((${spec.arabic}))`,
        translation: spec.translation,
        transliteration: TRANSLITERATIONS[spec.id]?.transliteration ?? null,
        instruction: null,
        repeat_count: spec.repeatCount,
        audio_url: null,
        order_index: 24 + index,
        audio_file: `adhkar_evening_${spec.morningId}.mp3`,
      });
    });
  });
});

describe('morning variant rows', () => {
  const variants = ['77', '78', '80', '81', '89', '90'];

  it('no longer carry the evening notes', () => {
    for (const id of variants) {
      const r = row(id);
      expect({id, arabic: r.arabic.includes('وإذا أمسى')}).toEqual({
        id,
        arabic: false,
      });
      for (const text of [r.translation, r.instruction]) {
        expect({id, text}).not.toEqual({
          id,
          text: expect.stringMatching(
            /In the evening:|For the evening|Note: for the evening|likewise, one says/,
          ),
        });
      }
      expect({id, translit: r.transliteration ?? ''}).not.toEqual({
        id,
        translit: expect.stringContaining('widha amsa'),
      });
    }
  });

  it('keeps the morning text itself', () => {
    expect(row('77').arabic.startsWith('((أَصْبَحْنَا')).toBe(true);
    expect(row('80').arabic.endsWith('(أربعَ مَرَّاتٍ).')).toBe(true);
    expect(row('78').translation).toBe(
      '(O Allah, by your leave we have reached the morning and by Your leave we have reached the evening, by Your leave we live and die and unto You is our resurrection.)',
    );
    expect(row('77').instruction).toBe('');
  });
});

describe('text, count and translation fixes', () => {
  it('uses the repeat count written in the text', () => {
    const counts: Record<string, number> = {
      '83': 7,
      '148': 7,
      '119': 3,
      '130': 3,
      '195': 100,
      '114': 3,
      '106': 33,
      '69': 33,
    };
    for (const [id, count] of Object.entries(counts)) {
      expect({id, count: row(id).repeat_count}).toEqual({id, count});
    }
  });

  it('pairs each Arabic text with its own translation', () => {
    expect(row('255').translation).toContain('ten times');
    expect(row('255').translation).toContain('four slaves');
    expect(row('255').instruction).toBe('');
    expect(row('185').translation).toBe(
      'If any one of you is invited, he should accept (the invitation). In case he is fasting, he should pray (in order to bless the inmates of the house), and if he is not fasting he should eat.',
    );
    expect(row('185').instruction).toBe('');
    expect(row('86').translation).toContain('the Hearer, the Knower');
    expect(row('86').translation).not.toContain('All-Seeing');
    expect(row('134').translation).toContain('His Messengers');
    expect(row('133').translation).toBe(
      '(Say:) I seek refuge in Allah. (Then you should desist from doing what you are in doubt about.)',
    );
    expect(row('61').transliteration).toBe(
      'Allahumma innee as-alukal-jannah, wa-aAAoothu bika minan-nar.',
    );
  });

  it('fills the missing and truncated Arabic', () => {
    expect(row('267').arabic).toContain('إِذَا كَانَ جُنْحُ');
    expect(row('267').arabic.endsWith('مَصَابِيحَكُمْ)).')).toBe(true);
    expect(row('quranic-35').arabic.endsWith('الْفَوْزُ الْعَظِيمُ')).toBe(
      true,
    );
    expect(row('quranic-35').translation).toContain(
      'And that is the great attainment.',
    );
  });

  it('gives row 119 a clean dhikr text for the tasbeeh widget', () => {
    const text = tasbeehDisplayText(row('119').arabic);
    expect(text).not.toBeNull();
    expect(text).not.toContain(')');
    expect(text?.split(' ')).toHaveLength(3);
  });
});

describe('audio mapping', () => {
  it('keeps one clip per Quranic dua, named after its row', () => {
    for (let n = 1; n <= 40; n++) {
      const id = `quranic-${n}`;
      expect({id, file: row(id).audio_file}).toEqual({
        id,
        file: `adhkar_${267 + n}.mp3`,
      });
    }
  });

  it('points rows 72 and 149 at their own hisnmuslim recordings', () => {
    expect(row('72').audio_url).toBe(
      'http://www.hisnmuslim.com/audio/ar/72.mp3',
    );
    expect(row('149').audio_url).toBe(
      'http://www.hisnmuslim.com/audio/ar/149.mp3',
    );
    expect(row('72').audio_file).toBe('adhkar_72.mp3');
    expect(row('149').audio_file).toBe('adhkar_149.mp3');
  });

  it('gives the evening list its own recording of every shared row but 96', () => {
    const shared = EVENING.filter(id => MORNING.includes(id) && id !== '96');
    expect(adhkarSeed.super_category_audio_overrides).toEqual({
      'evening-adhkar': Object.fromEntries(
        shared.map(id => [id, `adhkar_evening_${id}.mp3`]),
      ),
    });
    expect(row('96').audio_file).toBe('adhkar_96.mp3');
    expect(row('97').audio_file).toBe('adhkar_97.mp3');
  });
});
