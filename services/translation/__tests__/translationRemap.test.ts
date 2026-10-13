import {TRANSLATION_CROSSWALK} from '@/data/translationCrosswalk';
import {
  crosswalkTranslationId,
  remapLegacyTranslationId,
} from '../translationRemap';

describe('remapLegacyTranslationId (engine-managed QF translations)', () => {
  it('maps a matched AlQuranCloud id to its QF id', () => {
    expect(remapLegacyTranslationId('en.pickthall', true)).toBe('19');
    expect(remapLegacyTranslationId('en.yusufali', true)).toBe('22');
    expect(remapLegacyTranslationId('en.hilali', true)).toBe('203');
  });

  it('maps the retired bundled saheeh to QF 20', () => {
    expect(remapLegacyTranslationId('saheeh', true)).toBe('20');
  });

  it('maps an unmatched AlQuranCloud id to Clear Quran', () => {
    expect(remapLegacyTranslationId('en.asad', true)).toBe('clear-quran');
    expect(remapLegacyTranslationId('fa.makarem', true)).toBe('clear-quran');
  });

  it('keeps clear-quran and QF ids as they are', () => {
    expect(remapLegacyTranslationId('clear-quran', true)).toBe('clear-quran');
    expect(remapLegacyTranslationId('20', true)).toBe('20');
    expect(remapLegacyTranslationId('131', true)).toBe('131');
  });

  it('is idempotent', () => {
    for (const id of ['en.pickthall', 'saheeh', 'en.asad', '20']) {
      const once = remapLegacyTranslationId(id, true);
      expect(remapLegacyTranslationId(once, true)).toBe(once);
    }
  });

  it('follows text, not labels: two editions can share one QF id', () => {
    expect(remapLegacyTranslationId('zh.jian', true)).toBe('56');
    expect(remapLegacyTranslationId('zh.majian', true)).toBe('56');
  });
});

describe('remapLegacyTranslationId (a fork with its own provider)', () => {
  it('keeps provider ids and moves only saheeh to Clear Quran', () => {
    expect(remapLegacyTranslationId('en.pickthall', false)).toBe(
      'en.pickthall',
    );
    expect(remapLegacyTranslationId('en.asad', false)).toBe('en.asad');
    expect(remapLegacyTranslationId('saheeh', false)).toBe('clear-quran');
    expect(remapLegacyTranslationId('clear-quran', false)).toBe('clear-quran');
  });
});

describe('translation crosswalk', () => {
  it('ships the 53 text-matched editions plus saheeh, as QF ids', () => {
    expect(Object.keys(TRANSLATION_CROSSWALK)).toHaveLength(54);
    for (const value of Object.values(TRANSLATION_CROSSWALK)) {
      expect(Number.isInteger(value)).toBe(true);
    }
    expect(crosswalkTranslationId('saheeh')).toBe('20');
    expect(crosswalkTranslationId('en.asad')).toBeNull();
    // Inherited keys are not crosswalk entries.
    expect(crosswalkTranslationId('toString')).toBeNull();
  });
});
