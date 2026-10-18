// services/widgets/__tests__/widgetStaticData.test.ts
import fs from 'fs';
import path from 'path';
import {
  buildStaticAyat,
  buildStaticSurahs,
  buildSurahCatalogSwift,
  buildAdhkarPeriods,
  cleanTranslation,
  cutToBudget,
  sessionDhikrText,
  SESSION_MEDIUM_CHARS,
  AdhkarSeedRow,
  parseVerseKey,
  AyahSources,
  StaticAyah,
  StaticSurah,
} from '../widgetStaticData';
import {surahArtworkFileName} from '../buildSnapshot';

const root = path.resolve(__dirname, '../../..');

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function sources(overrides: Partial<AyahSources> = {}): AyahSources {
  return {
    words: () => ['قُلْ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ', '۝١'],
    translation: () => 'Say, "He is Allāh,<sup foot_note="1">1</sup> One."',
    surahName: () => 'Al-Ikhlas',
    ...overrides,
  };
}

describe('cleanTranslation', () => {
  it('drops footnote markers and tags and collapses spaces', () => {
    expect(
      cleanTranslation(
        'In the name of Allāh,<sup foot_note="226402">1</sup>  the <i>Merciful</i>.',
      ),
    ).toBe('In the name of Allāh, the Merciful.');
  });
});

describe('parseVerseKey', () => {
  it('parses valid keys and rejects bad ones', () => {
    expect(parseVerseKey('2:255')).toEqual({surahId: 2, ayah: 255});
    expect(parseVerseKey('115:1')).toBeNull();
    expect(parseVerseKey('2:0')).toBeNull();
    expect(parseVerseKey('two')).toBeNull();
  });
});

describe('buildStaticSurahs', () => {
  it('maps names, glyphs and card file names', () => {
    const out = buildStaticSurahs(
      [{id: 18, name: 'Al-Kahf', translated_name_english: 'The Cave'}],
      {18: ''},
    );
    expect(out).toEqual([
      {
        id: 18,
        name: 'Al-Kahf',
        translatedName: 'The Cave',
        glyph: '',
        artworkFile: 'surah-18.jpg',
      },
    ]);
  });
});

describe('buildSurahCatalogSwift', () => {
  it('writes one escaped row per surah', () => {
    const swift = buildSurahCatalogSwift(
      buildStaticSurahs(
        [
          {id: 1, name: 'Al-Fatihah', translated_name_english: 'The Opener'},
          {id: 2, name: 'Qaf', translated_name_english: 'The Letter "Qaf"'},
        ],
        {},
      ),
    );
    expect(swift).toContain('static let all: [SurahName] = [');
    expect(swift).toContain(
      '    SurahName(id: 1, name: "Al-Fatihah", translatedName: "The Opener"),',
    );
    expect(swift).toContain('translatedName: "The Letter \\"Qaf\\""');
  });

  it('rejects control characters', () => {
    expect(() =>
      buildSurahCatalogSwift(
        buildStaticSurahs(
          [{id: 1, name: 'a\nb', translated_name_english: 'x'}],
          {},
        ),
      ),
    ).toThrow('control character');
  });
});

describe('buildStaticAyat', () => {
  it('joins Digital Khatt words and cleans the translation', () => {
    const [a] = buildStaticAyat(['112:1'], sources());
    expect(a).toEqual({
      key: '112:1',
      surahId: 112,
      ayah: 1,
      surahName: 'Al-Ikhlas',
      arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ ۝١',
      translation: 'Say, "He is Allāh, One."',
    });
  });

  it('rejects duplicates, long ayat and missing data', () => {
    expect(() => buildStaticAyat(['112:1', '112:1'], sources())).toThrow(
      'duplicate',
    );
    const long = Array.from({length: 22}, (_, i) => `w${i}`);
    expect(() =>
      buildStaticAyat(['2:255'], sources({words: () => long})),
    ).toThrow('max 20');
    expect(() => buildStaticAyat(['1:1'], sources({words: () => []}))).toThrow(
      'Digital Khatt',
    );
    expect(() =>
      buildStaticAyat(['1:1'], sources({translation: () => undefined})),
    ).toThrow('translation');
  });
});

describe('generated widget data', () => {
  const iosAyat = 'targets/widgets/ayat.json';
  const androidAyat =
    'modules/bayaan-widgets/android/src/main/assets/widgets/ayat.json';
  const iosSurahs = 'targets/widgets/surahs.json';
  const androidSurahs =
    'modules/bayaan-widgets/android/src/main/assets/widgets/surahs.json';

  it('is identical on both platforms', () => {
    expect(fs.readFileSync(path.join(root, iosAyat), 'utf8')).toBe(
      fs.readFileSync(path.join(root, androidAyat), 'utf8'),
    );
    expect(fs.readFileSync(path.join(root, iosSurahs), 'utf8')).toBe(
      fs.readFileSync(path.join(root, androidSurahs), 'utf8'),
    );
  });

  it('matches the source list (run npm run generate:widget-data after editing it)', () => {
    const keys = readJson('data/widgets/ayah-of-the-day.json');
    const ayat = readJson(iosAyat) as StaticAyah[];
    expect(ayat.map(a => a.key)).toEqual(keys);
    expect(ayat).toHaveLength(390);
    for (const a of ayat) {
      expect(a.arabic.split(' ').pop()?.startsWith('۝')).toBe(true);
      expect(a.translation.length).toBeGreaterThan(0);
    }
  });

  it('SurahCatalog.swift matches surahs.json (run npm run generate:widget-data)', () => {
    const surahs = readJson(iosSurahs) as StaticSurah[];
    expect(
      fs.readFileSync(
        path.join(root, 'targets/widgets/_shared/SurahCatalog.swift'),
        'utf8',
      ),
    ).toBe(buildSurahCatalogSwift(surahs));
  });

  it('lists all 114 surahs with the card file name contract', () => {
    const surahs = readJson(iosSurahs) as StaticSurah[];
    expect(surahs).toHaveLength(114);
    surahs.forEach((s, i) => {
      expect(s.id).toBe(i + 1);
      expect(s.artworkFile).toBe(surahArtworkFileName(s.id));
      expect(s.glyph.length).toBe(1);
    });
  });
});

describe('sessionDhikrText', () => {
  it('uses the (( )) text without the count', () => {
    expect(
      sessionDhikrText('((سُبْحَانَ اللَّهِ وَبِحَمْدِهِ)) (مائة مرَّةٍ).'),
    ).toBe('سُبْحَانَ اللَّهِ وَبِحَمْدِهِ');
  });
  it('keeps unmarked text and drops bare parentheses', () => {
    expect(
      sessionDhikrText(
        '(بسم الله ﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾.) (بسم الله ﴿قُلْ أَعُوذُ﴾)',
      ),
    ).toBe('بسم الله ﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾. بسم الله ﴿قُلْ أَعُوذُ﴾');
  });
  it('trims trailing punctuation', () => {
    expect(sessionDhikrText('أَعُوذُ بِاللَّهِ ﴿اللَّهُ﴾.')).toBe(
      'أَعُوذُ بِاللَّهِ ﴿اللَّهُ﴾',
    );
  });
});

describe('cutToBudget', () => {
  it('returns short text unchanged', () => {
    expect(cutToBudget('a b c', 10)).toEqual({text: 'a b c', cut: false});
  });
  it('cuts at a word boundary and appends an ellipsis', () => {
    expect(cutToBudget('aaa bbb ccc ddd', 9)).toEqual({
      text: 'aaa bbb…',
      cut: true,
    });
  });
});

describe('buildAdhkarPeriods items', () => {
  const seed: AdhkarSeedRow[] = [
    {
      id: '2',
      category_id: '27',
      arabic: '((ب)) (ثلاثاً).',
      translation: 'B',
      repeat_count: 3,
      audio_file: 'adhkar_2.mp3',
      order_index: 1,
    },
    {
      id: '1',
      category_id: '27',
      arabic: '((أ))',
      translation: null,
      repeat_count: 0,
      audio_file: null,
      order_index: 0,
    },
    {
      id: '3',
      category_id: '27',
      arabic: `((${'كلمة '.repeat(60)}))`,
      translation: null,
      repeat_count: 1,
      audio_file: null,
      order_index: 2,
    },
    {
      id: '9',
      category_id: '30',
      arabic: '((x))',
      translation: null,
      repeat_count: 1,
      audio_file: null,
      order_index: 0,
    },
  ];
  const src = {
    superId: 'morning-adhkar',
    title: 'Morning Adhkar',
    arabicTitle: 'أذكار الصباح',
    categoryId: '27',
    featured: ['1'],
  };
  const periods = buildAdhkarPeriods(
    {morning: src, evening: {...src, superId: 'evening-adhkar'}},
    seed,
    {'morning-adhkar': ['1', '2', '3'], 'evening-adhkar': ['1', '2', '3']},
  );

  it('lists the category in order with repeat counts of at least 1', () => {
    expect(periods.morning.items.map(i => [i.id, i.repeatCount])).toEqual([
      ['1', 1],
      ['2', 3],
      ['3', 1],
    ]);
  });
  it('carries audio and display text', () => {
    expect(periods.morning.items[1]).toMatchObject({
      audioFile: 'adhkar_2.mp3',
      mediumText: 'ب',
      mediumCut: false,
      largeCut: false,
      translation: 'B',
    });
  });
  it('cuts long text for medium', () => {
    const long = periods.morning.items.find(i => i.id === '3');
    expect(long?.mediumCut).toBe(true);
    expect(long?.mediumText.length).toBeLessThanOrEqual(SESSION_MEDIUM_CHARS);
  });
});
