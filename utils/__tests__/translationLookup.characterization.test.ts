import {
  getBundledFootnotes,
  getBundledTranslation,
  getBundledTranslationRaw,
  getTranslationText,
  setActiveRemoteTranslationCache,
  clearActiveRemoteTranslationCache,
} from '../translationLookup';
import crypto from 'crypto';

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const mockGetAllVerses = jest.fn();
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {
    getAllVerses: (...args: unknown[]) => mockGetAllVerses(...args),
  },
}));

describe('translationLookup (characterization, develop behavior)', () => {
  // Exact bundled text, pinned by hash so a swapped or edited translation
  // fails (the prefix checks below would not catch Saheeh and Clear Quran
  // being swapped for 2:255).
  it('returns the exact bundled text for 1:1 and 2:255 in both translations', () => {
    expect({
      saheeh11: sha256(getBundledTranslation('1:1', 'saheeh')),
      saheeh2255: sha256(getBundledTranslation('2:255', 'saheeh')),
      clear11: sha256(getBundledTranslation('1:1', 'clear-quran')),
      clear2255: sha256(getBundledTranslation('2:255', 'clear-quran')),
    }).toEqual({
      saheeh11:
        'bb9ebf73f5e2c8b94a2956b0bc62f9315409cc3c933b24d2312f0399b5ab032a',
      saheeh2255:
        '8365bdf532d87bc3905904c012932b8a35e30a0e67c20eec474d1ad64d5e494f',
      clear11:
        '38fcf74d05c29c7478254a7c48623d214e4eaf3894fa9f529753207f0954e91c',
      clear2255:
        '23da26f47875bd83423f036ce01a181ae0222c86efa5509f373aa7250951f16d',
    });
  });

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

interface Isolated {
  rebuildEnhancedVerses: typeof import('../enhancedVerseData').rebuildEnhancedVerses;
  enhancedVersesBySurah: typeof import('../enhancedVerseData').enhancedVersesBySurah;
  getTranslationText: typeof import('../translationLookup').getTranslationText;
  getBundledTranslation: typeof import('../translationLookup').getBundledTranslation;
}

function loadIsolated(): Isolated {
  let loaded: Isolated | undefined;
  jest.isolateModules(() => {
    const enhanced = require('../enhancedVerseData');
    const lookup = require('../translationLookup');
    loaded = {
      rebuildEnhancedVerses: enhanced.rebuildEnhancedVerses,
      enhancedVersesBySurah: enhanced.enhancedVersesBySurah,
      getTranslationText: lookup.getTranslationText,
      getBundledTranslation: lookup.getBundledTranslation,
    };
  });
  if (!loaded) throw new Error('modules not loaded');
  return loaded;
}

describe('rebuildEnhancedVerses (characterization, develop behavior)', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockGetAllVerses.mockReset();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses a successful remote map and serves it from the sync cache', async () => {
    const m = loadIsolated();
    mockGetAllVerses.mockResolvedValue({'1:1': 'remote text'});
    expect(await m.rebuildEnhancedVerses('remote.ok')).toBe(true);
    expect(m.enhancedVersesBySurah[1][0].translation).toBe('remote text');
    expect(m.enhancedVersesBySurah[1][1].translation).toBe('');
    expect(m.getTranslationText('1:1', 'remote.ok')).toBe('remote text');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('falls back to Saheeh when a remote translation has no verses', async () => {
    const m = loadIsolated();
    const saheeh = m.getBundledTranslation('1:1', 'saheeh');
    await m.rebuildEnhancedVerses('clear-quran');
    expect(m.enhancedVersesBySurah[1][0].translation).not.toBe(saheeh);

    mockGetAllVerses.mockResolvedValue({});
    expect(await m.rebuildEnhancedVerses('unknown.remote')).toBe(true);
    expect(m.enhancedVersesBySurah[1][0].translation).toBe(saheeh);
    expect(warnSpy).toHaveBeenCalled();
    expect(m.getTranslationText('1:1', 'unknown.remote')).toBe('');
  });

  it('falls back to Saheeh when the remote load throws', async () => {
    const m = loadIsolated();
    const saheeh = m.getBundledTranslation('1:1', 'saheeh');
    await m.rebuildEnhancedVerses('clear-quran');
    expect(m.enhancedVersesBySurah[1][0].translation).not.toBe(saheeh);

    mockGetAllVerses.mockRejectedValue(new Error('db'));
    expect(await m.rebuildEnhancedVerses('another.remote')).toBe(true);
    expect(m.enhancedVersesBySurah[1][0].translation).toBe(saheeh);
    expect(warnSpy).toHaveBeenCalled();
    expect(m.getTranslationText('1:1', 'another.remote')).toBe('');
  });
});
