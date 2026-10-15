// services/widgets/__tests__/contentStaticData.test.ts
import fs from 'fs';
import path from 'path';
import {
  AdhkarPeriodSource,
  AdhkarSeedRow,
  AyahSources,
  buildAdhkarPeriods,
  buildOccasionData,
  isAdhkarPeriodSources,
  isOccasionsSource,
  OccasionsSource,
  OCCASION_IDS,
  parseAdhkarSeed,
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
  },
  {
    id: '2',
    category_id: '27',
    arabic: '((الْحَمْدُ لِلَّهِ))',
    translation: null,
    repeat_count: 1,
  },
  {
    id: '3',
    category_id: '28',
    arabic: '((بِاسْمِكَ))',
    translation: null,
    repeat_count: 1,
  },
  {
    id: '4',
    category_id: '27',
    arabic: 'no brackets here',
    translation: null,
    repeat_count: 1,
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
      categoryId: '27',
      featured: morning,
    },
    evening: {
      superId: 'evening-adhkar',
      title: 'Evening Adhkar',
      arabicTitle: 'أذكار المساء',
      categoryId: '27',
      featured: evening,
    },
  };
}

const ayahSources: AyahSources = {
  words: () => ['قُلْ', 'هُوَ', '۝١'],
  translation: () => 'Say, He.',
  surahName: () => 'Al-Ikhlas',
};

function occasionsSource(): OccasionsSource {
  return {
    months: Array.from({length: 12}, (_, i) => ({
      number: i + 1,
      name: `M${i + 1}`,
      arabic: `م${i + 1}`,
    })),
    occasions: OCCASION_IDS.map(id => ({
      id,
      name: id,
      arabicName: id,
      listenSurahId: id === 'jumuah' ? 18 : null,
      keys: ['112:1'],
    })),
  };
}

describe('buildAdhkarPeriods', () => {
  it('cleans featured adhkar and counts the category', () => {
    const out = buildAdhkarPeriods(periods(['1'], ['2', '1']), seed);
    expect(out.morning).toEqual({
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
    expect(out.evening.featured.map(f => f.id)).toEqual(['2', '1']);
    expect(out.evening.featured[0].translation).toBeNull();
  });

  it('rejects ids outside the category, text without (( )), and empty lists', () => {
    expect(() => buildAdhkarPeriods(periods(['3'], ['1']), seed)).toThrow(
      'not in category 27',
    );
    expect(() => buildAdhkarPeriods(periods(['4'], ['1']), seed)).toThrow(
      'no (( )) text',
    );
    expect(() => buildAdhkarPeriods(periods([], ['1']), seed)).toThrow(
      'no featured adhkar',
    );
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
      },
    ];
    expect(() => buildAdhkarPeriods(periods(['9'], ['1']), long)).toThrow(
      'too long',
    );
  });
});

describe('buildOccasionData', () => {
  it('builds every occasion with its ayat', () => {
    const out = buildOccasionData(occasionsSource(), ayahSources);
    expect(out.months).toHaveLength(12);
    expect(out.occasions.map(o => o.id)).toEqual([...OCCASION_IDS]);
    expect(out.occasions[7].listenSurahId).toBe(18);
    expect(out.occasions[0].ayat[0]).toEqual({
      key: '112:1',
      surahId: 112,
      ayah: 1,
      surahName: 'Al-Ikhlas',
      arabic: 'قُلْ هُوَ ۝١',
      translation: 'Say, He.',
    });
  });

  it('requires 12 months in order and exactly the known occasion ids', () => {
    const badMonths = {
      ...occasionsSource(),
      months: occasionsSource().months.slice(1),
    };
    expect(() => buildOccasionData(badMonths, ayahSources)).toThrow('months');
    const missing = {
      ...occasionsSource(),
      occasions: occasionsSource().occasions.slice(1),
    };
    expect(() => buildOccasionData(missing, ayahSources)).toThrow(
      'occasions must be exactly',
    );
  });
});

describe('source guards', () => {
  it('accept the committed sources and reject junk', () => {
    expect(
      isAdhkarPeriodSources(readJson('data/widgets/adhkar-periods.json')),
    ).toBe(true);
    expect(isOccasionsSource(readJson('data/widgets/occasions.json'))).toBe(
      true,
    );
    expect(isAdhkarPeriodSources({morning: {}})).toBe(false);
    expect(isOccasionsSource({months: [], occasions: [{id: 1}]})).toBe(false);
    expect(
      parseAdhkarSeed(readJson('data/adhkar.json')).length,
    ).toBeGreaterThan(400);
    expect(parseAdhkarSeed({adhkar: 'nope'})).toEqual([]);
  });
});

describe('generated content data', () => {
  const ios = 'targets/widgets';
  const android = 'modules/bayaan-widgets/android/src/main/assets/widgets';

  it('is identical on both platforms', () => {
    for (const name of ['adhkar-periods.json', 'occasions.json']) {
      expect(fs.readFileSync(path.join(root, ios, name), 'utf8')).toBe(
        fs.readFileSync(path.join(root, android, name), 'utf8'),
      );
    }
  });

  it('matches the sources (run npm run generate:widget-data after editing them)', () => {
    const source = readJson('data/widgets/adhkar-periods.json');
    if (!isAdhkarPeriodSources(source)) throw new Error('bad adhkar source');
    const expected = buildAdhkarPeriods(
      source,
      parseAdhkarSeed(readJson('data/adhkar.json')),
    );
    expect(readJson(`${ios}/adhkar-periods.json`)).toEqual(expected);
    expect(expected.morning.count).toBe(24);

    const occ = readJson('data/widgets/occasions.json');
    if (!isOccasionsSource(occ)) throw new Error('bad occasions source');
    const generated = readJson(`${ios}/occasions.json`) as {
      months: unknown[];
      occasions: {id: string; ayat: {key: string; arabic: string}[]}[];
    };
    expect(generated.months).toEqual(occ.months);
    expect(
      generated.occasions.map(o => [o.id, o.ayat.map(a => a.key)]),
    ).toEqual(occ.occasions.map(o => [o.id, o.keys]));
    for (const o of generated.occasions) {
      for (const a of o.ayat)
        expect(a.arabic.split(' ').pop()?.startsWith('۝')).toBe(true);
    }
  });
});
