import {
  getBundledFootnotes,
  getBundledTranslation,
  getBundledTranslationRaw,
  getTranslationText,
  setActiveRemoteTranslationCache,
  clearActiveRemoteTranslationCache,
} from '../translationLookup';

const mockGetAllVerses = jest.fn();
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {
    getAllVerses: (...args: unknown[]) => mockGetAllVerses(...args),
  },
}));

describe('translationLookup (characterization, develop behavior)', () => {
  it('returns Saheeh text for 1:1 and 2:255 (footnote tags are NOT stripped)', () => {
    const t11 = getBundledTranslation('1:1', 'saheeh');
    expect(t11.startsWith('In the name of')).toBe(true);
    expect(t11).toContain('<sup foot_note=');
    expect(getBundledTranslation('2:255', 'saheeh')).toContain('Ever-Living');
    expect(getBundledTranslationRaw('1:1', 'saheeh')).toBe(t11);
  });

  it('returns Clear Quran text with HTML stripped', () => {
    const t11 = getBundledTranslation('1:1', 'clear-quran');
    expect(t11.length).toBeGreaterThan(0);
    expect(t11).not.toMatch(/<[^>]*>/);
    expect(getBundledTranslation('2:255', 'clear-quran')).toContain(
      'Ever-Living',
    );
  });

  it('returns empty string for unknown verse keys', () => {
    expect(getBundledTranslation('999:1', 'saheeh')).toBe('');
    expect(getBundledTranslation('999:1', 'clear-quran')).toBe('');
  });

  it('returns the Saheeh footnote map and none for Clear Quran', () => {
    const real = getBundledFootnotes('1:1', 'saheeh');
    expect(Object.keys(real ?? {})).toEqual(['226402', '226403']);
    expect(getBundledFootnotes('1:1', 'clear-quran')).toBeUndefined();
  });

  it('getTranslationText returns empty for remote ids unless the active cache matches', () => {
    expect(getTranslationText('1:1', 'remote.x')).toBe('');
    setActiveRemoteTranslationCache('remote.x', {'1:1': 'hello'});
    expect(getTranslationText('1:1', 'remote.x')).toBe('hello');
    expect(getTranslationText('1:2', 'remote.x')).toBe('');
    expect(getTranslationText('1:1', 'remote.y')).toBe('');
    clearActiveRemoteTranslationCache();
    expect(getTranslationText('1:1', 'remote.x')).toBe('');
  });
});

describe('rebuildEnhancedVerses (characterization, develop behavior)', () => {
  it('falls back to Saheeh text when a remote translation has no verses', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockGetAllVerses.mockResolvedValue({});
    const {rebuildEnhancedVerses, enhancedVersesBySurah} =
      require('../enhancedVerseData') as typeof import('../enhancedVerseData');
    expect(await rebuildEnhancedVerses('unknown.remote')).toBe(true);
    expect(enhancedVersesBySurah[1][0].translation).toBe(
      getBundledTranslation('1:1', 'saheeh'),
    );
    expect(getTranslationText('1:1', 'unknown.remote')).toBe('');
  });

  it('falls back to Saheeh text when the remote load throws', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockGetAllVerses.mockRejectedValue(new Error('db'));
    const {rebuildEnhancedVerses, enhancedVersesBySurah} =
      require('../enhancedVerseData') as typeof import('../enhancedVerseData');
    expect(await rebuildEnhancedVerses('another.remote')).toBe(true);
    expect(enhancedVersesBySurah[1][0].translation).toBe(
      getBundledTranslation('1:1', 'saheeh'),
    );
  });
});
