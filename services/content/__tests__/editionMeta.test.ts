import {contentLanguageName} from '../contentLanguage';
import {resolveEditionMeta} from '../editionMeta';

describe('contentLanguageName', () => {
  it('maps QF names and ISO codes to English display names', () => {
    expect(contentLanguageName('english')).toBe('English');
    expect(contentLanguageName('urdu')).toBe('Urdu');
    expect(contentLanguageName('azeri')).toBe('Azerbaijani');
    expect(contentLanguageName('divehi')).toBe('Dhivehi');
    expect(contentLanguageName('en')).toBe('English');
    expect(contentLanguageName('ku')).toBe('Kurdish');
    expect(contentLanguageName('tg')).toBe('Tajik');
    expect(contentLanguageName('farsi')).toBe('Persian');
    expect(contentLanguageName('English')).toBe('English');
    expect(contentLanguageName(' bosnian ')).toBe('Bosnian');
    expect(contentLanguageName('xx')).toBeUndefined();
    expect(contentLanguageName('')).toBeUndefined();
    expect(contentLanguageName(undefined)).toBeUndefined();
  });
});

describe('resolveEditionMeta', () => {
  it('prefers the manifest meta', () => {
    expect(
      resolveEditionMeta(
        {name: 'Saheeh International', language: 'english', direction: 'ltr'},
        [{name: 'Old', englishName: 'Old', language: 'Arabic'}],
        'Translation 20',
      ),
    ).toEqual({
      name: 'Saheeh International',
      englishName: 'Saheeh International',
      language: 'English',
      direction: 'ltr',
    });
  });

  it('falls back field by field through the fallbacks, then defaults', () => {
    expect(
      resolveEditionMeta(
        undefined,
        [undefined, {name: 'Bundled', language: 'Arabic', direction: 'rtl'}],
        'Tafsir 1',
      ),
    ).toEqual({
      name: 'Bundled',
      englishName: 'Bundled',
      language: 'Arabic',
      direction: 'rtl',
    });
    expect(resolveEditionMeta(undefined, [], 'Tafsir 1')).toEqual({
      name: 'Tafsir 1',
      englishName: 'Tafsir 1',
      language: 'English',
      direction: 'ltr',
    });
  });
});
