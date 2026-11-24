// @ai-generated
import {localize, parseContent, parseLook} from '../look';

describe('localize', () => {
  it('picks the language, then English', () => {
    const text = {en: 'Tonight', ar: 'الليلة'};
    expect(localize(text, 'ar')).toBe('الليلة');
    expect(localize(text, 'ar-SA')).toBe('الليلة');
    expect(localize(text, 'fr')).toBe('Tonight');
    expect(localize('Plain', 'ar')).toBe('Plain');
    expect(localize(undefined, 'en')).toBeUndefined();
  });
});

describe('parseLook and parseContent', () => {
  it('keeps scenes it knows and https images', () => {
    expect(parseLook({kind: 'scene', scene: 'qadr'})).toEqual({
      kind: 'scene',
      scene: 'qadr',
    });
    expect(parseLook({kind: 'scene', scene: 'aurora'})).toBeUndefined();
    // Skies from earlier backends become the scene that replaced them.
    expect(parseLook({kind: 'sky', preset: 'eid'})).toEqual({
      kind: 'scene',
      scene: 'eidfitr',
    });
    expect(parseLook({kind: 'sky', preset: 'aurora'})).toBeUndefined();
    expect(
      parseLook({kind: 'image', uri: 'http://x.test/a.jpg'}),
    ).toBeUndefined();
    expect(
      parseLook({kind: 'image', uri: 'https://x.test/a.jpg', scrim: 3}),
    ).toEqual({
      kind: 'image',
      uri: 'https://x.test/a.jpg',
      tint: undefined,
      scrim: 1,
    });
  });

  it('drops words it cannot use', () => {
    expect(parseContent({title: '', label: 4})).toBeUndefined();
    expect(parseContent({title: {en: 'Eid Mubarak', ar: 'عيد مبارك'}})).toEqual(
      {
        title: {en: 'Eid Mubarak', ar: 'عيد مبارك'},
      },
    );
  });
});
