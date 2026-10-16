// services/widgets/__tests__/contentStaticData.test.ts
import fs from 'fs';
import path from 'path';
import {
  AdhkarPeriodSource,
  AdhkarSeedRow,
  buildAdhkarPeriods,
  isAdhkarPeriodSources,
  parseAdhkarSeed,
  parseAdhkarSeedLists,
} from '../widgetStaticData';

const root = path.resolve(__dirname, '../../..');

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

const seed: AdhkarSeedRow[] = [
  {
    id: '1',
    category_id: '27',
    arabic: '((سُبْحَانَ اللَّهِ)) (ثلاثاً).',
    translation: "'Glory be to Allah.'",
    repeat_count: 3,
    audio_file: null,
    order_index: 0,
  },
  {
    id: '2',
    category_id: '27',
    arabic: '((الْحَمْدُ لِلَّهِ))',
    translation: null,
    repeat_count: 1,
    audio_file: null,
    order_index: 1,
  },
  {
    id: '3',
    category_id: '28',
    arabic: '((بِاسْمِكَ))',
    translation: null,
    repeat_count: 1,
    audio_file: null,
    order_index: 2,
  },
  {
    id: '4',
    category_id: '27',
    arabic: 'no brackets here',
    translation: null,
    repeat_count: 1,
    audio_file: null,
    order_index: 3,
  },
];

function periods(
  morning: string[],
  evening: string[],
): Record<'morning' | 'evening', AdhkarPeriodSource> {
  return {
    morning: {
      superId: 'morning-adhkar',
      title: 'Morning Adhkar',
      arabicTitle: 'أذكار الصباح',
      featured: morning,
    },
    evening: {
      superId: 'evening-adhkar',
      title: 'Evening Adhkar',
      arabicTitle: 'أذكار المساء',
      featured: evening,
    },
  };
}

const lists = {
  'morning-adhkar': ['1', '2', '4'],
  'evening-adhkar': ['2', '1'],
};

describe('buildAdhkarPeriods', () => {
  it('cleans featured adhkar and counts the category', () => {
    const out = buildAdhkarPeriods(periods(['1'], ['2', '1']), seed, lists);
    const {items, ...morning} = out.morning;
    expect(items.map(i => i.id)).toEqual(['1', '2', '4']);
    expect(morning).toEqual({
      period: 'morning',
      superId: 'morning-adhkar',
      title: 'Morning Adhkar',
      arabicTitle: 'أذكار الصباح',
      count: 3,
      featured: [
        {
          id: '1',
          arabic: 'سُبْحَانَ اللَّهِ',
          translation: 'Glory be to Allah.',
          repeatCount: 3,
        },
      ],
    });
    expect(out.evening.count).toBe(2);
    expect(out.evening.featured.map(f => f.id)).toEqual(['2', '1']);
    expect(out.evening.featured[0].translation).toBeNull();
  });

  it('rejects ids outside the period list, text without (( )), and empty lists', () => {
    expect(() =>
      buildAdhkarPeriods(periods(['3'], ['1']), seed, lists),
    ).toThrow('not in the morning-adhkar list');
    expect(() =>
      buildAdhkarPeriods(periods(['4'], ['1']), seed, lists),
    ).toThrow('no (( )) text');
    expect(() => buildAdhkarPeriods(periods([], ['1']), seed, lists)).toThrow(
      'no featured adhkar',
    );
    expect(() =>
      buildAdhkarPeriods(periods(['1'], ['1']), seed, {
        'morning-adhkar': ['1'],
      }),
    ).toThrow('no dhikr list for evening-adhkar');
  });

  it('rejects text longer than 180 characters', () => {
    const long = [
      ...seed,
      {
        id: '9',
        category_id: '27',
        arabic: `((${'ا'.repeat(181)}))`,
        translation: null,
        repeat_count: 1,
        audio_file: null,
        order_index: 9,
      },
    ];
    expect(() =>
      buildAdhkarPeriods(periods(['9'], ['1']), long, {
        ...lists,
        'morning-adhkar': ['9'],
      }),
    ).toThrow('too long');
  });
});

describe('source guards', () => {
  it('accept the committed sources and reject junk', () => {
    expect(
      isAdhkarPeriodSources(readJson('data/widgets/adhkar-periods.json')),
    ).toBe(true);
    expect(isAdhkarPeriodSources({morning: {}})).toBe(false);
    expect(
      parseAdhkarSeed(readJson('data/adhkar.json')).length,
    ).toBeGreaterThan(400);
    expect(parseAdhkarSeed({adhkar: 'nope'})).toEqual([]);
    const committed = parseAdhkarSeedLists(readJson('data/adhkar.json'));
    expect(committed['morning-adhkar']).toHaveLength(23);
    expect(committed['evening-adhkar']).toHaveLength(21);
    expect(parseAdhkarSeedLists({})).toEqual({});
    expect(parseAdhkarSeedLists({super_category_dhikr_ids: {x: [1]}})).toEqual(
      {},
    );
  });
});

describe('generated content data', () => {
  const ios = 'targets/widgets';
  const android = 'modules/bayaan-widgets/android/src/main/assets/widgets';

  it('is identical on both platforms', () => {
    for (const name of ['adhkar-periods.json']) {
      expect(fs.readFileSync(path.join(root, ios, name), 'utf8')).toBe(
        fs.readFileSync(path.join(root, android, name), 'utf8'),
      );
    }
  });

  it('matches the sources (run npm run generate:widget-data after editing them)', () => {
    const source = readJson('data/widgets/adhkar-periods.json');
    if (!isAdhkarPeriodSources(source)) throw new Error('bad adhkar source');
    const adhkarSeed = readJson('data/adhkar.json');
    const seedLists = parseAdhkarSeedLists(adhkarSeed);
    const expected = buildAdhkarPeriods(
      source,
      parseAdhkarSeed(adhkarSeed),
      seedLists,
    );
    expect(readJson(`${ios}/adhkar-periods.json`)).toEqual(expected);
    expect(expected.morning.count).toBe(23);
    expect(expected.evening.count).toBe(21);
    for (const f of expected.evening.featured) {
      expect(seedLists['evening-adhkar']).toContain(f.id);
    }
    expect(expected.evening.featured.map(f => f.id)).not.toContain('94');
  });
});
