import {
  getBundledTranslation,
  getBundledTranslationRaw,
  getRemoteFootnote,
  getTranslationText,
  isBundledTranslation,
  stripFootnoteMarkers,
  setActiveRemoteTranslationCache,
  clearActiveRemoteTranslationCache,
} from '../translationLookup';
import crypto from 'crypto';

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const mockGetAllVerses = jest.fn();
const mockGetFootnotes = jest.fn();
const mockGetDownloaded = jest.fn();
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {
    getAllVerses: (...args: unknown[]) => mockGetAllVerses(...args),
    getFootnotes: (...args: unknown[]) => mockGetFootnotes(...args),
    getDownloadedTranslations: (...args: unknown[]) =>
      mockGetDownloaded(...args),
  },
}));

describe('translationLookup (characterization, develop behavior)', () => {
  // Exact bundled text, pinned by hash so a swapped or edited translation
  // fails. Changed on purpose (QF translations switch-over): the bundled
  // Saheeh International is gone, so its two hashes were dropped; Clear
  // Quran's are unchanged.
  it('returns the exact bundled text for 1:1 and 2:255', () => {
    expect({
      clear11: sha256(getBundledTranslation('1:1', 'clear-quran')),
      clear2255: sha256(getBundledTranslation('2:255', 'clear-quran')),
    }).toEqual({
      clear11:
        '38fcf74d05c29c7478254a7c48623d214e4eaf3894fa9f529753207f0954e91c',
      // Changed on purpose: 2:255's footnote marker digit is now removed.
      clear2255:
        'c47913e69c60ff0f02bd3763c6ad45e15444420556e32d948191bbe23ecd332e',
    });
  });

  // Replaces the bundled Saheeh text check: Saheeh is QF 20 now, a download.
  it('bundles Clear Quran only; "saheeh" is no longer bundled', () => {
    expect(isBundledTranslation('clear-quran')).toBe(true);
    expect(isBundledTranslation('saheeh')).toBe(false);
    expect(getTranslationText('1:1', 'saheeh')).toBe('');
  });

  it('returns Clear Quran text with HTML stripped', () => {
    const t11 = getBundledTranslation('1:1', 'clear-quran');
    expect(t11.length).toBeGreaterThan(0);
    expect(t11).not.toMatch(/<[^>]*>/);
    expect(getBundledTranslation('2:255', 'clear-quran')).toContain(
      'Ever-Living',
    );
  });

  it('strips Clear Quran footnote markers with their digits, plain and raw', () => {
    // The source reads "...Lord of all worlds,<sup foot_note=76373>1</sup>".
    expect(getBundledTranslation('1:2', 'clear-quran')).toMatch(
      /Lord of all worlds,$/,
    );
    expect(getBundledTranslationRaw('1:2', 'clear-quran')).toBe(
      getBundledTranslation('1:2', 'clear-quran'),
    );
    expect(getBundledTranslation('2:255', 'clear-quran')).not.toMatch(/\d\s*$/);
  });

  it('stripFootnoteMarkers removes quoted and unquoted markers only', () => {
    expect(
      stripFootnoteMarkers(
        'a,<sup foot_note=1>1</sup> b<sup foot_note="2">2</sup> <b>c</b>',
      ),
    ).toBe('a, b <b>c</b>');
  });

  it('returns empty string for unknown verse keys', () => {
    expect(getBundledTranslation('999:1', 'clear-quran')).toBe('');
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

  it('getRemoteFootnote reads the active edition footnotes as plain text', () => {
    setActiveRemoteTranslationCache(
      '20',
      {'1:1': 'a<sup foot_note=7>1</sup>'},
      {'7': '<p>First &amp; one.</p><p>Second.</p>', '8': 'Plain'},
    );
    expect(getRemoteFootnote('20', '7')).toBe('First & one.\n\nSecond.');
    expect(getRemoteFootnote('20', '8')).toBe('Plain');
    expect(getRemoteFootnote('20', '9')).toBeUndefined();
    expect(getRemoteFootnote('19', '7')).toBeUndefined();
    clearActiveRemoteTranslationCache();
    expect(getRemoteFootnote('20', '7')).toBeUndefined();
  });
});

interface Isolated {
  rebuildEnhancedVerses: typeof import('../enhancedVerseData').rebuildEnhancedVerses;
  enhancedVersesBySurah: typeof import('../enhancedVerseData').enhancedVersesBySurah;
  getTranslationText: typeof import('../translationLookup').getTranslationText;
  getBundledTranslation: typeof import('../translationLookup').getBundledTranslation;
  getRemoteFootnote: typeof import('../translationLookup').getRemoteFootnote;
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
      getRemoteFootnote: lookup.getRemoteFootnote,
    };
  });
  if (!loaded) throw new Error('modules not loaded');
  return loaded;
}

describe('rebuildEnhancedVerses (characterization, develop behavior)', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockGetAllVerses.mockReset();
    mockGetFootnotes.mockReset();
    mockGetFootnotes.mockResolvedValue({});
    mockGetDownloaded.mockReset();
    mockGetDownloaded.mockResolvedValue([]);
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

  it('caches the edition footnotes with its verses, and keeps the verses when they fail', async () => {
    const m = loadIsolated();
    mockGetAllVerses.mockResolvedValue({'1:1': 'a<sup foot_note=7>1</sup>'});
    mockGetFootnotes.mockResolvedValue({'7': '<p>note</p>'});
    await m.rebuildEnhancedVerses('20');
    expect(mockGetFootnotes).toHaveBeenCalledWith('20');
    expect(m.getRemoteFootnote('20', '7')).toBe('note');

    mockGetFootnotes.mockRejectedValue(new Error('db'));
    expect(await m.rebuildEnhancedVerses('21')).toBe(true);
    expect(m.getTranslationText('1:1', '21')).toBe('a<sup foot_note=7>1</sup>');
    expect(m.getRemoteFootnote('21', '7')).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // Changed on purpose (QF translations switch-over): the default and the
  // fallback are Clear Quran, the only bundled edition, instead of Saheeh.
  it('starts on Clear Quran', () => {
    const m = loadIsolated();
    expect(m.enhancedVersesBySurah[1][0].translation).toBe(
      m.getBundledTranslation('1:1', 'clear-quran'),
    );
  });

  it('falls back to Clear Quran when a remote translation has no verses', async () => {
    const m = loadIsolated();
    const clear = m.getBundledTranslation('1:1', 'clear-quran');
    mockGetAllVerses.mockResolvedValue({'1:1': 'remote text'});
    await m.rebuildEnhancedVerses('remote.ok');
    expect(m.enhancedVersesBySurah[1][0].translation).toBe('remote text');

    mockGetAllVerses.mockResolvedValue({});
    expect(await m.rebuildEnhancedVerses('unknown.remote')).toBe(true);
    expect(m.enhancedVersesBySurah[1][0].translation).toBe(clear);
    expect(warnSpy).toHaveBeenCalled();
    expect(m.getTranslationText('1:1', 'unknown.remote')).toBe('');
  });

  it('falls back to Clear Quran when the remote load throws', async () => {
    const m = loadIsolated();
    const clear = m.getBundledTranslation('1:1', 'clear-quran');
    mockGetAllVerses.mockResolvedValue({'1:1': 'remote text'});
    await m.rebuildEnhancedVerses('remote.ok');

    mockGetAllVerses.mockRejectedValue(new Error('db'));
    expect(await m.rebuildEnhancedVerses('another.remote')).toBe(true);
    expect(m.enhancedVersesBySurah[1][0].translation).toBe(clear);
    expect(warnSpy).toHaveBeenCalled();
    expect(m.getTranslationText('1:1', 'another.remote')).toBe('');
  });

  // Content sync replaces an edition's rows in place (a legacy copy, the
  // Saheeh auto-install): a new download time reads them again.
  it('rebuilds the same edition only when its download revision changes', async () => {
    const m = loadIsolated();
    mockGetAllVerses.mockResolvedValue({'1:1': 'old'});
    mockGetDownloaded.mockResolvedValue([
      {identifier: '19', downloadedAt: 100},
    ]);
    expect(await m.rebuildEnhancedVerses('19')).toBe(true);
    // The revision read with the rows matches: no second read.
    expect(await m.rebuildEnhancedVerses('19', 100)).toBe(false);
    expect(await m.rebuildEnhancedVerses('19')).toBe(false);

    mockGetAllVerses.mockResolvedValue({'1:1': 'new'});
    mockGetDownloaded.mockResolvedValue([
      {identifier: '19', downloadedAt: 200},
    ]);
    expect(await m.rebuildEnhancedVerses('19', 200)).toBe(true);
    expect(m.getTranslationText('1:1', '19')).toBe('new');
  });

  it('reads a selected edition once it lands after a fallback', async () => {
    const m = loadIsolated();
    mockGetAllVerses.mockResolvedValue({});
    await m.rebuildEnhancedVerses('20');
    mockGetAllVerses.mockResolvedValue({'1:1': 'saheeh text'});
    mockGetDownloaded.mockResolvedValue([
      {identifier: '20', downloadedAt: 300},
    ]);
    expect(await m.rebuildEnhancedVerses('20', 300)).toBe(true);
    expect(m.enhancedVersesBySurah[1][0].translation).toBe('saheeh text');
  });
});
