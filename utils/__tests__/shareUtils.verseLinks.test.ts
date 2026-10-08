// @ai-generated
/**
 * Verse links of a rewayah (decision 3): a link names its verse by the
 * verse's storage anchor, so it names exactly the shared rewayah verse (the
 * two parts of a split Hafs verse are two links), while its path stays the
 * Hafs verse the web reader can open. Hafs links are unchanged.
 * Every verse of every words DB: unitAnnotations.alldbs.test.ts (local).
 */
import {anchorShareUrl, verseShareUrl} from '../shareUtils';
import {
  FIXTURE_REWAYAT,
  fixtureUnits,
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

  it('names every fixture verse of every rewayah by its anchor', () => {
    for (const rewayah of FIXTURE_REWAYAT) {
      const units = fixtureUnits(rewayah);
      for (const unit of units.units) {
        const anchor = units.hafsAnchor(unit);
        // The path is the Hafs verse holding the verse's first word, plus
        // the word it starts at when that is inside the Hafs verse.
        const word =
          rewayah !== 'hafs' && anchor.wordPosition > 1
            ? `&word=${anchor.wordPosition}`
            : '';
        expect(anchorShareUrl(anchor.key, 'light', rewayah)).toBe(
          verseShareUrl(anchor.surah, anchor.ayah, 'light', rewayah) + word,
        );
        // That location is exactly this verse.
        expect(units.unitForAnchor(anchor.key)).toBe(unit);
      }
    }
  });
});
