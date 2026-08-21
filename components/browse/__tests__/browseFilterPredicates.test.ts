/**
 * browseFilterPredicates — RFC-020 unit coverage for the pure reciter-level
 * seam predicates shared by `BrowseReciters` (the destination filter chain)
 * and the composer test surface.
 *
 * Covers each dimension in isolation, AND-composition (chaining two
 * predicates narrows to the intersection — the exact behaviour the
 * destination relies on for a multi-chip filter), and tolerance of an unset
 * field (`country` / `translation` are absent until a fork populates them —
 * neither should ever match). Pure module: no RN imports, so this runs
 * without the heavy BrowseReciters dependency graph.
 */
import type {Reciter, Rewayat} from '@/data/reciterData';
import {
  reciterHasFullQuran,
  reciterMatchesCountry,
  reciterMatchesTranslation,
} from '../browseFilterPredicates';

function makeRewayat(surahTotal: number, id = 'rw'): Rewayat {
  return {
    id,
    reciter_id: 'r',
    name: "Hafs A'n Assem",
    style: 'murattal',
    server: 'https://example.test',
    surah_total: surahTotal,
    surah_list: Array.from({length: surahTotal}, (_, i) => i + 1),
    source_type: 'test',
    created_at: '2026-01-01',
  };
}

function makeReciter(overrides: Partial<Reciter> = {}): Reciter {
  return {
    id: 'r',
    name: 'Test Reciter',
    date: null,
    image_url: null,
    rewayat: [makeRewayat(114)],
    ...overrides,
  };
}

describe('reciterHasFullQuran (full-quran dimension)', () => {
  it('keeps a reciter with a 114-total rewaya', () => {
    expect(
      reciterHasFullQuran(makeReciter({rewayat: [makeRewayat(114)]})),
    ).toBe(true);
  });

  it('rejects a reciter whose only rewaya covers fewer than 114 surahs', () => {
    expect(reciterHasFullQuran(makeReciter({rewayat: [makeRewayat(30)]}))).toBe(
      false,
    );
  });

  it('keeps a reciter where ANY rewaya is complete (multi-rewaya)', () => {
    const reciter = makeReciter({
      rewayat: [makeRewayat(30, 'partial'), makeRewayat(114, 'full')],
    });
    expect(reciterHasFullQuran(reciter)).toBe(true);
  });

  it('rejects a reciter with no rewayat', () => {
    expect(reciterHasFullQuran(makeReciter({rewayat: []}))).toBe(false);
  });
});

describe('reciterMatchesCountry (country dimension)', () => {
  it('slug-matches a single-word country', () => {
    expect(
      reciterMatchesCountry(makeReciter({country: 'Algeria'}), 'algeria'),
    ).toBe(true);
  });

  it('slug-matches a multi-word country (spaces → dashes)', () => {
    expect(
      reciterMatchesCountry(
        makeReciter({country: 'Saudi Arabia'}),
        'saudi-arabia',
      ),
    ).toBe(true);
  });

  it('rejects a non-matching slug', () => {
    expect(
      reciterMatchesCountry(makeReciter({country: 'Egypt'}), 'algeria'),
    ).toBe(false);
  });

  it('rejects an unset or empty country', () => {
    expect(reciterMatchesCountry(makeReciter(), 'algeria')).toBe(false);
    expect(reciterMatchesCountry(makeReciter({country: ''}), 'algeria')).toBe(
      false,
    );
  });
});

describe('reciterMatchesTranslation (translation dimension)', () => {
  it('slug-matches a single-word language', () => {
    expect(
      reciterMatchesTranslation(
        makeReciter({translation: 'Spanish'}),
        'spanish',
      ),
    ).toBe(true);
  });

  it('slug-matches a multi-word language (spaces → dashes)', () => {
    expect(
      reciterMatchesTranslation(
        makeReciter({translation: 'Simplified Chinese'}),
        'simplified-chinese',
      ),
    ).toBe(true);
  });

  it('rejects a non-matching slug', () => {
    expect(
      reciterMatchesTranslation(makeReciter({translation: 'English'}), 'urdu'),
    ).toBe(false);
  });

  it('rejects an unset or empty translation', () => {
    expect(reciterMatchesTranslation(makeReciter(), 'spanish')).toBe(false);
    expect(
      reciterMatchesTranslation(makeReciter({translation: ''}), 'spanish'),
    ).toBe(false);
  });
});

describe('AND-composition across dimensions (intersection)', () => {
  // A small mixed catalog: country + full-quran + translation vary
  // independently.
  const catalog: Reciter[] = [
    makeReciter({
      id: 'a',
      country: 'Algeria',
      rewayat: [makeRewayat(114)],
      translation: 'Spanish',
    }),
    makeReciter({
      id: 'b',
      country: 'Algeria',
      rewayat: [makeRewayat(30)], // Algeria but not complete, no translation
    }),
    makeReciter({
      id: 'c',
      country: 'Egypt',
      rewayat: [makeRewayat(114)],
      translation: 'Spanish', // complete + Spanish, but Egypt
    }),
    makeReciter({
      id: 'd',
      country: 'Algeria',
      rewayat: [makeRewayat(114)], // Algeria + complete, no translation
    }),
  ];

  const idsMatching = (pred: (r: Reciter) => boolean): string[] =>
    catalog.filter(pred).map(r => r.id);

  it('country alone keeps every Algerian reciter', () => {
    expect(idsMatching(r => reciterMatchesCountry(r, 'algeria'))).toEqual([
      'a',
      'b',
      'd',
    ]);
  });

  it('country AND full-quran keeps the intersection', () => {
    expect(
      idsMatching(
        r => reciterMatchesCountry(r, 'algeria') && reciterHasFullQuran(r),
      ),
    ).toEqual(['a', 'd']);
  });

  it('country AND translation narrows further than country AND full-quran', () => {
    expect(
      idsMatching(
        r =>
          reciterMatchesCountry(r, 'algeria') &&
          reciterMatchesTranslation(r, 'spanish'),
      ),
    ).toEqual(['a']);
  });

  it('all three composed keeps only the reciter in every set', () => {
    expect(
      idsMatching(
        r =>
          reciterMatchesCountry(r, 'algeria') &&
          reciterHasFullQuran(r) &&
          reciterMatchesTranslation(r, 'spanish'),
      ),
    ).toEqual(['a']);
  });

  it('dropping the country predicate widens the set (chip removal)', () => {
    // Removing the country chip leaves full-quran + translation active → 'c'
    // rejoins.
    expect(
      idsMatching(
        r => reciterHasFullQuran(r) && reciterMatchesTranslation(r, 'spanish'),
      ),
    ).toEqual(['a', 'c']);
  });
});
