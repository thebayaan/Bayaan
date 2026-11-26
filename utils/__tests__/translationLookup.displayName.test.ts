/**
 * The translation names the Translation page shows (getTranslationDisplayName):
 * the bundled translations by their name in the app language, which says in
 * Arabic that they are English translations; a downloaded translation by the
 * name its catalogue gives it, in every language.
 */
import i18n from 'i18next';
import {
  getTranslationDisplayName,
  getTranslationName,
  registerRemoteTranslationName,
} from '../translationLookup';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('getTranslationDisplayName', () => {
  it('English: the bundled names, as every caption shows them', () => {
    expect(getTranslationDisplayName('saheeh')).toBe('Saheeh International');
    expect(getTranslationDisplayName('clear-quran')).toBe('The Clear Quran');
    expect(getTranslationDisplayName('saheeh')).toBe(
      getTranslationName('saheeh'),
    );
    expect(getTranslationDisplayName('clear-quran')).toBe(
      getTranslationName('clear-quran'),
    );
  });

  it('Arabic: the bundled translations by their Arabic names, marked English', async () => {
    await i18n.changeLanguage('ar');
    expect(getTranslationDisplayName('saheeh')).toBe(
      'صحيح إنترناشونال (بالإنجليزية)',
    );
    expect(getTranslationDisplayName('clear-quran')).toBe(
      'القرآن الواضح (بالإنجليزية)',
    );
  });

  it('a downloaded translation keeps its catalogue name in both languages', async () => {
    registerRemoteTranslationName('ur.jalandhry', 'Jalandhry');
    expect(getTranslationDisplayName('ur.jalandhry')).toBe('Jalandhry');
    await i18n.changeLanguage('ar');
    expect(getTranslationDisplayName('ur.jalandhry')).toBe('Jalandhry');
    // A name not known yet: the identifier, as before.
    expect(getTranslationDisplayName('en.unregistered')).toBe(
      'en.unregistered',
    );
  });
});
