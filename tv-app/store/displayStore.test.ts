import {storage} from '../services/storage';
import {
  findTranslation,
  onScreenLabel,
  textScale,
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
});
