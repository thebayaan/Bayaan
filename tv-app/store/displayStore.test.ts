import {storage} from '../services/storage';
import {
  findTranslation,
  onScreenLabel,
  dimLabel,
  textScale,
  translationLanguages,
  translationRowLabel,
  TRANSLATIONS,
  useDisplayStore,
} from './displayStore';

describe('displayStore', () => {
  it('defaults to Arabic with Saheeh International at large size', () => {
    const {mode, edition, textSize} = useDisplayStore.getState();
    expect({mode, edition, textSize}).toEqual({
      mode: 'both',
      edition: 'en.sahih',
      textSize: 'large',
    });
  });

  it('saves each choice', () => {
    useDisplayStore.getState().setEdition('fr.hamidullah');
    useDisplayStore.getState().setTextSize('xlarge');
    const saved = JSON.parse(storage.getString('bayaan_tv_display') ?? '{}');
    expect(saved).toEqual({
      mode: 'both',
      edition: 'fr.hamidullah',
      textSize: 'xlarge',
      dimAfterMin: 10,
    });
  });

  it('labels what is on screen by language', () => {
    expect(onScreenLabel('both', 'fr.hamidullah')).toBe('Arabic + Français');
    expect(onScreenLabel('translation', 'en.sahih')).toBe('English');
    expect(onScreenLabel('calligraphy', 'en.sahih')).toBe('Calligraphy');
  });

  it('falls back to the first translation for an unknown edition', () => {
    expect(findTranslation('xx.none')).toBe(TRANSLATIONS[0]);
  });

  it('scales text by size', () => {
    expect(textScale('medium')).toBeLessThan(textScale('large'));
    expect(textScale('xlarge')).toBeGreaterThan(textScale('large'));
  });

  it('saves the dim delay and labels it', () => {
    useDisplayStore.getState().setDimAfter(0);
    expect(useDisplayStore.getState().dimAfterMin).toBe(0);
    const saved = JSON.parse(storage.getString('bayaan_tv_display') ?? '{}');
    expect(saved.dimAfterMin).toBe(0);
    expect(dimLabel(0)).toBe('Never');
    expect(dimLabel(10)).toBe('After 10 min');
  });

  it('lists each language once with its first edition', () => {
    const languages = translationLanguages();
    expect(languages[0]).toEqual({language: 'English', edition: 'en.sahih'});
    expect(languages.filter(l => l.language === 'English')).toHaveLength(1);
    expect(languages.some(l => l.edition === 'fr.hamidullah')).toBe(true);
  });

  it('names the translation row language first, then the translator', () => {
    expect(translationRowLabel('fr.hamidullah')).toBe(
      'Français · Muhammad Hamidullah',
    );
    expect(translationRowLabel('en.sahih')).toBe(
      'English · Saheeh International',
    );
    // An unknown edition falls back like findTranslation.
    expect(translationRowLabel('xx.gone')).toBe(
      'English · Saheeh International',
    );
  });
});
