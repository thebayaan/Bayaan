// services/widgets/__tests__/buildCatalog.test.ts
import {isWidgetCatalog} from 'bayaan-widgets';
import type {Reciter} from '@/data/reciterData';
import adhkarSeed from '@/data/adhkar.json';
import {
  buildCatalog,
  buildTasbeehEntries,
  createCountDayTracker,
  DEFAULT_TASBEEH_DHIKR_ID,
  seedAdhkar,
  tasbeehAdhkar,
  tasbeehDisplayText,
  tasbeehTranslation,
  TASBEEH_ADHKAR,
} from '../buildCatalog';

function reciter(id: string, name: string): Reciter {
  return {id, name, date: null, image_url: null, rewayat: []};
}

describe('tasbeehDisplayText', () => {
  it('keeps the dhikr inside the double brackets without counts', () => {
    expect(
      tasbeehDisplayText('((سُبْحَانَ اللَّهِ وَبِحَمْدِهِ)) (مائة مرَّةٍ).'),
    ).toBe('سُبْحَانَ اللَّهِ وَبِحَمْدِهِ');
    expect(
      tasbeehDisplayText(
        '((سُبْحَانَ اللَّهِ، وَاللَّهُ أَكْبَرُ (ثلاثاً وثلاثين) لاَ إِلَهَ إِلاَّ اللَّهُ))',
      ),
    ).toBe('سُبْحَانَ اللَّهِ، وَاللَّهُ أَكْبَرُ لاَ إِلَهَ إِلاَّ اللَّهُ');
  });

  it('rejects narrations that do not start with the dhikr', () => {
    expect(
      tasbeehDisplayText(
        'قَالَ صلى الله عليه وسلم مَنْ قَالَ: سُبْحَانَ اللَّهِ',
      ),
    ).toBeNull();
    expect(tasbeehDisplayText('(بسم الله الرحمن الرحيم)')).toBeNull();
  });
});

describe('tasbeehTranslation', () => {
  it('drops wrapping brackets, counts and edge quotes', () => {
    expect(
      tasbeehTranslation(
        '(How perfect Allah is and I praise Him.)(one hundred times)',
      ),
    ).toBe('How perfect Allah is and I praise Him.');
    expect(
      tasbeehTranslation(
        '(How perfect my Lord is, The Supreme.’(three times))',
      ),
    ).toBe('How perfect my Lord is, The Supreme.');
    expect(
      tasbeehTranslation(
        '‘I seek Allaah’s forgiveness and I turn to Him in repentance.’ [one hundred times a day]',
      ),
    ).toBe('I seek Allaah’s forgiveness and I turn to Him in repentance.');
    expect(tasbeehTranslation(null)).toBeNull();
  });
});

describe('tasbeeh adhkar', () => {
  it('picks the 13 repeatable adhkar from the seed', () => {
    expect(TASBEEH_ADHKAR.map(d => d.id)).toEqual([
      '86',
      '87',
      '91',
      '92',
      '93',
      '94',
      '96',
      '97',
      '98',
      '33',
      '41',
      '69',
      '72',
    ]);
    const seedArabic = seedAdhkar(adhkarSeed).find(
      d => d.id === DEFAULT_TASBEEH_DHIKR_ID,
    )?.arabic;
    const arabic = tasbeehDisplayText(seedArabic ?? '');
    expect(arabic?.normalize('NFC')).toBe(
      'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ'.normalize('NFC'),
    );
    expect(TASBEEH_ADHKAR.find(d => d.id === DEFAULT_TASBEEH_DHIKR_ID)).toEqual(
      {
        id: '91',
        arabic,
        translation: 'How perfect Allah is and I praise Him.',
        repeatCount: 100,
      },
    );
    TASBEEH_ADHKAR.forEach(d =>
      expect(d.arabic.length).toBeLessThanOrEqual(180),
    );
  });

  it('ignores malformed seed rows and single repeats', () => {
    expect(seedAdhkar({adhkar: [{id: 1}, 'x']})).toEqual([]);
    expect(seedAdhkar(null)).toEqual([]);
    expect(
      tasbeehAdhkar([
        {id: 'a', arabic: '((ذكر))', translation: null, repeat_count: 1},
      ]),
    ).toEqual([]);
  });
});

describe('buildCatalog', () => {
  it('lists reciters by name with artwork file names and skips the placeholder', () => {
    const catalog = buildCatalog(
      [reciter('r2', 'Sudais'), reciter('', ''), reciter('r1', 'Alafasi')],
      TASBEEH_ADHKAR,
    );
    expect(isWidgetCatalog(catalog)).toBe(true);
    expect(catalog.reciters).toEqual([
      {id: 'r1', name: 'Alafasi', artworkFile: 'reciter-r1.jpg'},
      {id: 'r2', name: 'Sudais', artworkFile: 'reciter-r2.jpg'},
    ]);
    expect(catalog.adhkar).toBe(TASBEEH_ADHKAR);
  });
});

describe('buildTasbeehEntries', () => {
  it('gives every tasbeeh dhikr today’s count and its target', () => {
    const entries = buildTasbeehEntries(
      TASBEEH_ADHKAR.slice(0, 3),
      {'91': 12},
      '2026-10-10',
    );
    expect(entries).toEqual({
      '86': {count: 0, target: 3, day: '2026-10-10'},
      '87': {count: 0, target: 3, day: '2026-10-10'},
      '91': {count: 12, target: 100, day: '2026-10-10'},
    });
  });
});

describe('createCountDayTracker', () => {
  it('drops counts that were loaded on an earlier day', () => {
    const track = createCountDayTracker();
    const counts = {'91': 12, '96': 3};
    expect(track(counts, '2026-10-10')).toEqual({'91': 12, '96': 3});
    // Midnight passes without the store resetting its in-memory numbers.
    expect(track(counts, '2026-10-11')).toEqual({});
    // A tap on the new day refreshes only that dhikr.
    expect(track({...counts, '91': 13}, '2026-10-11')).toEqual({'91': 13});
  });

  it('forgets a dhikr after it is reset', () => {
    const track = createCountDayTracker();
    track({'91': 12}, '2026-10-10');
    expect(track({}, '2026-10-10')).toEqual({});
    expect(track({'91': 12}, '2026-10-11')).toEqual({'91': 12});
  });
});
