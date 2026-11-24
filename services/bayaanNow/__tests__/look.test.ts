// @ai-generated
import {
  bodyPosition,
  defaultSky,
  localize,
  parseContent,
  parseLook,
} from '../look';

const at = (hour: number, minute = 0) => new Date(2026, 10, 23, hour, minute);

describe('defaultSky', () => {
  it('follows the time of day', () => {
    expect(defaultSky('morning', at(5))).toBe('fajr');
    expect(defaultSky('morning', at(8))).toBe('morning');
    expect(defaultSky('midday', at(13))).toBe('midday');
    expect(defaultSky('evening', at(18))).toBe('sunset');
    expect(defaultSky('bedtime', at(23))).toBe('night');
    expect(defaultSky('bedtime', at(2))).toBe('night');
  });

  it("uses Jumu'ah for the Friday surah", () => {
    expect(defaultSky('friday', at(20))).toBe('jumuah');
  });
});

describe('bodyPosition', () => {
  it('puts the sun highest at midday and low at the ends', () => {
    const noon = bodyPosition('sun', at(12));
    const early = bodyPosition('sun', at(6));
    expect(noon.x).toBeCloseTo(0.5, 1);
    expect(noon.y).toBeLessThan(early.y);
    expect(early.x).toBeLessThan(noon.x);
  });

  it('moves the moon across the night, past midnight', () => {
    const late = bodyPosition('moon', at(23));
    const small = bodyPosition('moon', at(3));
    expect(small.x).toBeGreaterThan(late.x);
  });

  it('stays inside the sky', () => {
    for (let h = 0; h < 24; h++) {
      const p = bodyPosition('sun', at(h));
      expect(p.x).toBeGreaterThanOrEqual(0.1);
      expect(p.x).toBeLessThanOrEqual(0.9);
    }
  });
});

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
  it('keeps presets it knows and https images', () => {
    expect(parseLook({kind: 'sky', preset: 'eid'})).toEqual({
      kind: 'sky',
      preset: 'eid',
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
