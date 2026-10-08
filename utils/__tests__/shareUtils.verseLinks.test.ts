// @ai-generated
/**
 * Verse links of a rewayah (decision 3): a link names its verse by the
 * verse's storage anchor, so it resolves to exactly the shared rewayah verse
 * (the two parts of a split Hafs verse are two links), while its path stays
 * the Hafs verse the web reader can open. Hafs links are unchanged.
 * Every verse of every words DB: unitAnnotations.alldbs.test.ts (local).
 */
import {
  anchorShareUrl,
  parseVerseShareUrl,
  resolveVerseShareLink,
  verseShareUrl,
} from '../shareUtils';
import {
  FIXTURE_REWAYAT,
  fixtureUnits,
  must,
  unitOf,
} from '@/services/verse-annotations/__fixtures__/verseUnitsTestData';
import branding from '@/config/branding';

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackShareCreated: jest.fn()},
}));

const BASE = branding.shareBaseUrl;

describe('verseShareUrl (Hafs links unchanged)', () => {
  it('builds the links of before', () => {
    expect(verseShareUrl(2, 255)).toBe(`${BASE}/quran/2/255`);
    expect(verseShareUrl(2, 255, 'dark')).toBe(`${BASE}/quran/2/255`);
    expect(verseShareUrl(2, 255, 'light')).toBe(
      `${BASE}/quran/2/255?theme=light`,
    );
    expect(verseShareUrl(2, 255, 'dark', 'hafs')).toBe(`${BASE}/quran/2/255`);
    expect(verseShareUrl(2, 255, 'light', 'warsh')).toBe(
      `${BASE}/quran/2/255?theme=light&rewayah=warsh`,
    );
  });
});

describe('anchorShareUrl', () => {
  it('equals verseShareUrl for every Hafs anchor', () => {
    for (const theme of [undefined, 'dark', 'light'] as const) {
      for (const rewayah of [undefined, 'hafs']) {
        expect(anchorShareUrl('2:255', theme, rewayah)).toBe(
          verseShareUrl(2, 255, theme, rewayah),
        );
        // A Hafs link never carries a word: Hafs verses are whole.
        expect(anchorShareUrl('1:7:5', theme, rewayah)).toBe(
          verseShareUrl(1, 7, theme, rewayah),
        );
      }
    }
  });

  it('adds the word of a verse that starts inside a Hafs verse', () => {
    expect(anchorShareUrl('1:7', 'dark', 'warsh')).toBe(
      `${BASE}/quran/1/7?rewayah=warsh`,
    );
    expect(anchorShareUrl('1:7:5', 'dark', 'warsh')).toBe(
      `${BASE}/quran/1/7?rewayah=warsh&word=5`,
    );
    expect(anchorShareUrl('1:7:5', 'light', 'warsh')).toBe(
      `${BASE}/quran/1/7?theme=light&rewayah=warsh&word=5`,
    );
    expect(anchorShareUrl('bad', 'dark', 'warsh')).toBeNull();
  });
});

describe('parseVerseShareUrl', () => {
  it('reads verse links in every form', () => {
    expect(parseVerseShareUrl(`${BASE}/quran/2/255`)).toEqual({
      surah: 2,
      ayah: 255,
      word: 1,
      rewayah: 'hafs',
      anchor: '2:255',
    });
    expect(
      parseVerseShareUrl(`${BASE}/quran/1/7?theme=light&rewayah=warsh&word=5`),
    ).toEqual({surah: 1, ayah: 7, word: 5, rewayah: 'warsh', anchor: '1:7:5'});
    expect(parseVerseShareUrl('bayaan://quran/1/7/?rewayah=warsh#x')).toEqual({
      surah: 1,
      ayah: 7,
      word: 1,
      rewayah: 'warsh',
      anchor: '1:7',
    });
    expect(parseVerseShareUrl('/quran/18/86?rewayah=al-bazzi&word=14')).toEqual(
      {surah: 18, ayah: 86, word: 14, rewayah: 'al-bazzi', anchor: '18:86:14'},
    );
    // Old rewayah slugs map to their canonical ids.
    expect(parseVerseShareUrl('/quran/1/7?rewayah=qaloon')?.rewayah).toBe(
      'qalun',
    );
    expect(parseVerseShareUrl('/quran/1/7?rewayah=hafs&word=1')?.anchor).toBe(
      '1:7',
    );
  });

  it('refuses anything it cannot name exactly', () => {
    for (const url of [
      `${BASE}/quran/2`,
      `${BASE}/quran/2/255/3`,
      `${BASE}/mushaf/5`,
      `${BASE}/reciter/x/2`,
      '/quran/0/1',
      '/quran/115/1',
      '/quran/1/0',
      '/quran/1/7?rewayah=unknown',
      '/quran/1/7?rewayah=',
      '/quran/1/7?rewayah=warsh&word=0',
      '/quran/1/7?rewayah=warsh&word=x',
      '/quran/1/7?rewayah=warsh&word=',
      '/quran/1/7?rewayah=%E0%A4%A',
    ]) {
      expect(parseVerseShareUrl(url)).toBeNull();
    }
  });
});

describe('resolveVerseShareLink', () => {
  it('lands on exactly the shared verse', () => {
    const warsh = fixtureUnits('warsh');
    const resolve = (url: string) =>
      resolveVerseShareLink(must(parseVerseShareUrl(url)), warsh);
    expect(resolve('/quran/1/7?rewayah=warsh')).toBe(unitOf(warsh, '1:6'));
    expect(resolve('/quran/1/7?rewayah=warsh&word=5')).toBe(
      unitOf(warsh, '1:7'),
    );
    expect(resolve('/quran/103/2?rewayah=warsh')).toBe(unitOf(warsh, '103:1'));
    // The basmala is not a verse in Warsh; a word past the verse: none.
    expect(resolve('/quran/1/1?rewayah=warsh')).toBeNull();
    expect(resolve('/quran/1/7?rewayah=warsh&word=99')).toBeNull();
    // Another rewayah's link is not resolved with Warsh verses.
    expect(
      resolveVerseShareLink(
        must(parseVerseShareUrl('/quran/1/7?rewayah=qalun')),
        warsh,
      ),
    ).toBeNull();
  });

  it('round-trips every fixture verse of every rewayah', () => {
    for (const rewayah of FIXTURE_REWAYAT) {
      const units = fixtureUnits(rewayah);
      for (const unit of units.units) {
        const anchor = units.hafsAnchor(unit);
        const url = must(anchorShareUrl(anchor.key, 'light', rewayah));
        const link = must(parseVerseShareUrl(url));
        expect(link.rewayah).toBe(rewayah);
        // The path is the Hafs verse holding the verse's first word.
        expect(`${link.surah}:${link.ayah}`).toBe(anchor.hafsKey);
        expect(resolveVerseShareLink(link, units)).toBe(unit);
      }
    }
  });
});
