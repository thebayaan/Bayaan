// scripts/__tests__/adhkarTextPolish.test.ts
// Checks data/adhkar.json against the text polish inputs in
// scripts/adhkar-content (translit.json, names.json, hisnmuslimRows.json,
// markerFixes.json, translitMarkerFixes.json, rowFixes.json,
// translitFitrahive.json).
import adhkarData from '@/data/adhkar.json';
import {parseAdhkarArabic, type AdhkarSegment} from '@/utils/adhkarText';
import {
  FITRAHIVE_ALTERNATIVES,
  FITRAHIVE_RULED_IDS,
  KEEP_INSTRUCTION_IDS,
  MARKER_FIXES,
  NAME_MEANINGS,
  NAMES_CATEGORY,
  ROW_FIXES,
  SITE_ROWS,
  TRANSLIT_MARKER_FIXES,
  TRANSLITERATIONS,
  UNCHANGED,
  arabicSkeleton,
  markerFreeText,
  tidyQuranReferences,
  withoutMarkers,
} from '../adhkar-content/textPolish';

interface Row {
  id: string;
  category_id: string;
  arabic: string;
  translation: string | null;
  transliteration: string | null;
  instruction: string | null;
}

const rows: readonly Row[] = adhkarData.adhkar;
const nonNames = rows.filter(r => r.category_id !== NAMES_CATEGORY);
const names = rows.filter(r => r.category_id === NAMES_CATEGORY);

function row(id: string): Row {
  const found = rows.find(r => r.id === id);
  if (!found) throw new Error(`row ${id} missing`);
  return found;
}

function kinds(segments: AdhkarSegment[]): string[] {
  return segments.map(s => s.kind);
}

describe('transliterations', () => {
  const ruled = new Set(FITRAHIVE_RULED_IDS);
  const keep = new Set(KEEP_INSTRUCTION_IDS);

  it('cover every non-name row and nothing else', () => {
    expect(Object.keys(TRANSLITERATIONS).sort()).toEqual(
      nonNames.map(r => r.id).sort(),
    );
  });

  it('equal the input value on every row outside the rulings', () => {
    for (const r of nonNames) {
      if (ruled.has(r.id)) continue;
      const input = TRANSLITERATIONS[r.id].transliteration;
      const fix = TRANSLIT_MARKER_FIXES[r.id];
      if (fix)
        expect({id: r.id, before: fix.before}).toEqual({
          id: r.id,
          before: input,
        });
      expect({id: r.id, value: r.transliteration}).toEqual({
        id: r.id,
        value: fix ? fix.after : input,
      });
    }
  });

  it('take the input instruction unless it says UNCHANGED', () => {
    for (const r of nonNames) {
      const input = TRANSLITERATIONS[r.id].instruction;
      if (input === UNCHANGED || keep.has(r.id)) continue;
      expect({id: r.id, value: r.instruction}).toEqual({
        id: r.id,
        value: input,
      });
    }
  });

  it('use the fitrahive value for row 77 only because its Arabic has the same words (letter skeleton)', () => {
    const alt = FITRAHIVE_ALTERNATIVES['77'];
    expect(arabicSkeleton(alt.arabic)).toBe(arabicSkeleton(row('77').arabic));
    expect(row('77').transliteration).toBe(alt.transliteration);
    expect(row('77').transliteration).not.toContain('laylah');
  });

  it('leave the other ruled rows without a transliteration', () => {
    for (const id of ['125', 'evening-80', 'evening-81']) {
      expect(FITRAHIVE_ALTERNATIVES[id]).toBeUndefined();
      expect({id, value: row(id).transliteration}).toEqual({id, value: null});
    }
  });

  it('drop the stray English from row 125 and keep 133 from repeating its translation', () => {
    expect(row('125').instruction).toBeNull();
    expect(row('133').instruction).not.toBe(row('133').translation);
  });
});

describe('99 Names', () => {
  it('use the Wikipedia meanings', () => {
    expect(names).toHaveLength(99);
    for (const r of names) {
      expect({id: r.id, value: r.translation}).toEqual({
        id: r.id,
        value: NAME_MEANINGS[r.id].meaning,
      });
    }
  });

  it('take the source transliteration for name-91 only', () => {
    expect(row('name-91').transliteration).toBe(
      NAME_MEANINGS['name-91'].transliteration,
    );
    expect(row('name-1').transliteration).toBe('Ar Rahmaan');
  });

  it('keep trimmed transliterations with one apostrophe style', () => {
    for (const r of names) {
      const value = r.transliteration ?? '';
      expect({id: r.id, trimmed: value === value.trim()}).toEqual({
        id: r.id,
        trimmed: true,
      });
      expect(value).not.toMatch(/[‘’]|\s{2}/);
    }
    expect(row('name-72').transliteration).toBe("Al Mu'akhir");
  });

  it('leave no stray translation in an instruction', () => {
    expect(row('name-50').instruction).toBeNull();
    for (const r of names) {
      expect({id: r.id, value: r.instruction ?? ''}).not.toEqual({
        id: r.id,
        value: expect.stringMatching(/\\|[éèàçêù]|\b(Le|est|des|qui)\b/),
      });
    }
  });
});

describe('99 Names Quran references', () => {
  it('rewrites spaced references to a clean second line', () => {
    expect(
      tidyQuranReferences(
        'He who acts with extreme kindness  | Quran: (2:163) (3: 31) (4:100) (5:3)',
      ),
    ).toBe('He who acts with extreme kindness\nQuran: 2:163, 3:31, 4:100, 5:3');
  });

  it('rewrites run-together references and drops duplicates', () => {
    expect(
      tidyQuranReferences(
        'The Sovereign | Quran: (20:114)(23:116)(20:114)(62:1)',
      ),
    ).toBe('The Sovereign\nQuran: 20:114, 23:116, 62:1');
  });

  it('leaves rows without references or with odd ones unchanged', () => {
    expect(tidyQuranReferences('Plain guidance.')).toBe('Plain guidance.');
    expect(tidyQuranReferences(null)).toBeNull();
    const odd = 'Text | Quran: (3:6)(4:15 9)';
    expect(tidyQuranReferences(odd)).toBe(odd);
  });

  it('corrects the known name-8 digit typos', () => {
    expect(
      tidyQuranReferences('Al-Aziz | Quran: (3:6)(4:15 8)(9:40)(4 8:7)'),
    ).toBe('Al-Aziz\nQuran: 3:6, 4:158, 9:40, 48:7');
  });

  it('is idempotent', () => {
    const once = tidyQuranReferences('A  | Quran: (1:3) (2: 4)');
    expect(tidyQuranReferences(once)).toBe(once);
  });

  it('leaves no raw " | Quran:" in generated data', () => {
    const raw = names.filter(r => (r.instruction ?? '').includes('| Quran:'));
    expect(raw.map(r => r.id)).toEqual([]);
  });
});

describe('rows restored from hisnmuslim.com', () => {
  it('match the site text stored in the inputs', () => {
    for (const id of ['114', '197', '267']) {
      const r = row(id);
      const site = SITE_ROWS[id];
      expect(r.arabic.trim()).not.toBe('');
      expect(r.translation?.trim()).toBeTruthy();
      expect(withoutMarkers(r.arabic)).toBe(withoutMarkers(site.arabic));
      expect(r.translation).toBe(
        ROW_FIXES.rows[id]?.translation ?? site.translation,
      );
    }
  });

  it('restore all four Arabic steps of row 114', () => {
    const text = row('114').arabic;
    for (const step of ['يَنْفُثُ', 'يَسْتَعِيذُ', 'يُحَدِّثْ', 'جَنْبِهِ']) {
      expect(text.normalize('NFC')).toContain(step.normalize('NFC'));
    }
  });
});

describe('marker fixes', () => {
  it('change only marker characters', () => {
    for (const [id, fix] of Object.entries(MARKER_FIXES)) {
      expect({id, same: markerFreeText(fix.before)}).toEqual({
        id,
        same: markerFreeText(fix.after),
      });
      expect({id, applied: row(id).arabic}).toEqual({id, applied: fix.after});
    }
  });

  it('leave no stray marks after parsing', () => {
    for (const id of Object.keys(MARKER_FIXES)) {
      for (const segment of parseAdhkarArabic(row(id).arabic)) {
        expect({id, text: segment.text}).not.toEqual({
          id,
          text: expect.stringMatching(/\(\(|\)\)|\[|\]/),
        });
      }
    }
  });

  it('show the entering and leaving instructions as narration (rows 20, 21)', () => {
    for (const id of ['20', '21']) {
      const [first, second] = parseAdhkarArabic(row(id).arabic);
      expect({id, kind: first.kind}).toEqual({id, kind: 'narration'});
      expect(first.text.normalize('NFC')).toContain(
        'يَبْدَأُ بِرِجْلِهِ'.normalize('NFC'),
      );
      expect({id, kind: second.kind}).toEqual({id, kind: 'dhikr'});
    }
  });

  it('split the hadith rows where the site quotes the words', () => {
    expect(kinds(parseAdhkarArabic(row('254').arabic))).toEqual([
      'narration',
      'dhikr',
      'narration',
    ]);
    expect(kinds(parseAdhkarArabic(row('236').arabic))).toEqual([
      'narration',
      'dhikr',
      'narration',
      'dhikr',
      'narration',
    ]);
    for (const id of ['134', '195', '135']) {
      expect({id, kinds: kinds(parseAdhkarArabic(row(id).arabic))}).toEqual({
        id,
        kinds: ['narration', 'dhikr'],
      });
    }
    expect(kinds(parseAdhkarArabic(row('206').arabic))).toEqual(['dhikr']);
    expect(kinds(parseAdhkarArabic(row('70').arabic))).toEqual([
      'dhikr',
      'narration',
    ]);
    expect(kinds(parseAdhkarArabic(row('99').arabic))).toEqual([
      'narration',
      'dhikr',
      'narration',
    ]);
  });

  it('show the additions of row 19 as additions', () => {
    expect(kinds(parseAdhkarArabic(row('19').arabic))).toEqual([
      'dhikr',
      'addition',
      'addition',
      'addition',
    ]);
  });

  it('mark only the words to say in the "let him say" rows', () => {
    const shapes: Record<string, string[]> = {
      '151': ['narration', 'dhikr'],
      '179': ['narration', 'dhikr', 'narration', 'dhikr'],
      '217': ['narration', 'dhikr'],
      '227': ['narration', 'dhikr'],
      '258': ['narration', 'dhikr', 'narration'],
      '260': ['narration', 'dhikr'],
    };
    for (const [id, expected] of Object.entries(shapes)) {
      expect({id, kinds: kinds(parseAdhkarArabic(row(id).arabic))}).toEqual({
        id,
        kinds: expected,
      });
    }
    const dhikr260 = parseAdhkarArabic(row('260').arabic)[1].text;
    expect(dhikr260.normalize('NFC')).toBe(
      'لاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ'.normalize('NFC'),
    );
  });

  it('close the Quran bracket of row 50', () => {
    expect(row('50').arabic).toContain('﴾))');
  });

  it('move the count notes out of the dhikr (rows 66, 69, 106, 138)', () => {
    for (const id of ['66', '69', '106', '138']) {
      const segments = parseAdhkarArabic(row(id).arabic);
      expect({
        id,
        narration: segments.some(s => s.kind === 'narration'),
      }).toEqual({id, narration: true});
      for (const segment of segments) {
        expect({id, text: segment.text}).not.toEqual({
          id,
          text: expect.stringMatching(/[()]/),
        });
      }
    }
  });

  it('show the name instruction of row 155 as narration and turn the row 238 gloss into commas', () => {
    const segments = parseAdhkarArabic(row('155').arabic);
    expect(kinds(segments)).toEqual(['dhikr', 'narration', 'dhikr']);
    expect(segments[1].text.normalize('NFC')).toBe(
      'بِاسْمِهِ'.normalize('NFC'),
    );
    expect(row('238').arabic).not.toMatch(/[()]/);
  });
});

describe('transliteration marker fixes', () => {
  it('change only marker characters and are applied', () => {
    for (const [id, fix] of Object.entries(TRANSLIT_MARKER_FIXES)) {
      expect({id, same: markerFreeText(fix.before)}).toEqual({
        id,
        same: markerFreeText(fix.after),
      });
      expect({id, applied: row(id).transliteration}).toEqual({
        id,
        applied: fix.after,
      });
    }
  });

  it('leave no visible bracket in any transliteration after parsing', () => {
    for (const r of rows) {
      if (!r.transliteration) continue;
      for (const segment of parseAdhkarArabic(r.transliteration)) {
        expect({id: r.id, text: segment.text}).not.toEqual({
          id: r.id,
          text: expect.stringMatching(/[()[\]{}]/),
        });
      }
    }
  });

  it('render count notes and placeholders as narration', () => {
    const shapes: Record<string, string[]> = {
      '66': ['dhikr', 'narration', 'dhikr'],
      '106': ['dhikr', 'narration', 'dhikr', 'narration', 'dhikr', 'narration'],
      '129': ['dhikr', 'narration', 'dhikr'],
      '160': ['dhikr', 'narration', 'dhikr'],
      '5': ['dhikr', 'addition', 'dhikr'],
      '10': ['dhikr'],
      '50': ['dhikr'],
    };
    for (const [id, expected] of Object.entries(shapes)) {
      const transliteration = row(id).transliteration ?? '';
      expect({id, kinds: kinds(parseAdhkarArabic(transliteration))}).toEqual({
        id,
        kinds: expected,
      });
    }
  });
});

describe('rows from published editions', () => {
  it('take the sunnah.com translation and transliteration', () => {
    for (const [id, fix] of Object.entries(ROW_FIXES.rows)) {
      expect(fix.sourceUrl).toBe(`https://sunnah.com/hisn:${id}`);
      expect({id, value: row(id).translation}).toEqual({
        id,
        value: fix.translation,
      });
      expect(TRANSLITERATIONS[id].sourceUrl).toBe(fix.sourceUrl);
      expect({id, value: row(id).transliteration}).toEqual({
        id,
        value: TRANSLITERATIONS[id].transliteration,
      });
    }
  });

  it('correct the category 86 title on the category and its rows', () => {
    const title = ROW_FIXES.categories['86'].title;
    expect(title.startsWith('Invocation')).toBe(true);
    expect(adhkarData.categories.find(c => c.id === '86')?.title).toBe(title);
    for (const r of adhkarData.adhkar.filter(a => a.category_id === '86')) {
      expect(r.category_name).toBe(title);
    }
  });
});

describe('meta', () => {
  it('holds the real totals', () => {
    expect(adhkarData.meta.total_categories).toBe(adhkarData.categories.length);
    expect(adhkarData.meta.total_duas).toBe(adhkarData.adhkar.length);
  });
});
