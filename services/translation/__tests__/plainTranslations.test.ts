// @ai-generated
// Copy and Share-as-text read a downloaded translation from a copy held in
// memory, which exists only once the selected translation has been applied.
// Right after launch (or when that read failed) the copied text silently had
// no translation. A miss is now read from the translations database.

const mockGetTranslation = jest.fn();
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {
    getTranslation: (...args: unknown[]) => mockGetTranslation(...args),
  },
}));

import {loadPlainTranslations} from '../plainTranslations';
import {
  clearActiveRemoteTranslationCache,
  setActiveRemoteTranslationCache,
} from '@/utils/translationLookup';

beforeEach(() => {
  mockGetTranslation.mockReset();
  clearActiveRemoteTranslationCache();
});

describe('loadPlainTranslations', () => {
  it('gives a bundled translation without its footnote markers, never asking the database', async () => {
    const translationOf = await loadPlainTranslations(
      ['1:1', '2:255'],
      'saheeh',
    );
    expect(translationOf('1:1')).toBe(
      'In the name of Allāh, the Entirely Merciful, the Especially Merciful.',
    );
    expect(translationOf('2:255')).toContain(
      'the Ever-Living, the Self-Sustaining. Neither',
    );
    expect(translationOf('2:255')).not.toMatch(/[<>]/);
    expect(mockGetTranslation).not.toHaveBeenCalled();
  });

  it('uses the in-memory copy of a downloaded translation when it is there', async () => {
    setActiveRemoteTranslationCache('ur.jalandhry', {'1:1': 'urdu 1:1'});
    const translationOf = await loadPlainTranslations(['1:1'], 'ur.jalandhry');
    expect(translationOf('1:1')).toBe('urdu 1:1');
    expect(mockGetTranslation).not.toHaveBeenCalled();
  });

  it('reads a downloaded translation from the database when it is not in memory', async () => {
    mockGetTranslation.mockImplementation(async (verseKey: string) =>
      verseKey === '1:1' ? 'urdu <b>1:1</b>' : null,
    );
    const translationOf = await loadPlainTranslations(
      ['1:1', '1:2', '1:1'],
      'ur.jalandhry',
    );
    expect(translationOf('1:1')).toBe('urdu 1:1');
    expect(translationOf('1:2')).toBe('');
    // Each verse once, in the selected translation.
    expect(mockGetTranslation.mock.calls).toEqual([
      ['1:1', 'ur.jalandhry'],
      ['1:2', 'ur.jalandhry'],
    ]);
  });

  it('reads only the verses the in-memory copy does not have', async () => {
    setActiveRemoteTranslationCache('ur.jalandhry', {'1:1': 'urdu 1:1'});
    mockGetTranslation.mockResolvedValue('urdu 1:2');
    const translationOf = await loadPlainTranslations(
      ['1:1', '1:2'],
      'ur.jalandhry',
    );
    expect(translationOf('1:1')).toBe('urdu 1:1');
    expect(translationOf('1:2')).toBe('urdu 1:2');
    expect(mockGetTranslation.mock.calls).toEqual([['1:2', 'ur.jalandhry']]);
  });

  it('gives no translation, without failing, when the database cannot be read', async () => {
    mockGetTranslation.mockRejectedValue(
      new Error('TranslationDbService not initialized'),
    );
    const translationOf = await loadPlainTranslations(['1:1'], 'ur.jalandhry');
    expect(translationOf('1:1')).toBe('');
    expect(translationOf('9:9')).toBe('');
  });
});
