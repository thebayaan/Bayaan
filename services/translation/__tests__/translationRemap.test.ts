import {TRANSLATION_CROSSWALK} from '@/data/translationCrosswalk';
import {
  crosswalkTranslationId,
  providerTranslationSelection,
  qfTranslationSelection,
} from '../translationRemap';

describe('qfTranslationSelection (engine-managed QF translations)', () => {
  it('maps a matched AlQuranCloud id to its QF id', () => {
    expect(qfTranslationSelection('en.pickthall')).toBe('19');
    expect(qfTranslationSelection('en.yusufali')).toBe('22');
    expect(qfTranslationSelection('en.hilali')).toBe('203');
  });

  it('maps the retired bundled saheeh to QF 20', () => {
    expect(qfTranslationSelection('saheeh')).toBe('20');
  });

  it('maps an unmatched AlQuranCloud id to Clear Quran', () => {
    expect(qfTranslationSelection('en.asad')).toBe('clear-quran');
    expect(qfTranslationSelection('fa.makarem')).toBe('clear-quran');
  });

  it('keeps clear-quran and QF ids as they are', () => {
    expect(qfTranslationSelection('clear-quran')).toBe('clear-quran');
    expect(qfTranslationSelection('20')).toBe('20');
    expect(qfTranslationSelection('131')).toBe('131');
  });

  it('is idempotent', () => {
    for (const id of ['en.pickthall', 'saheeh', 'en.asad', '20']) {
      const once = qfTranslationSelection(id);
      expect(qfTranslationSelection(once)).toBe(once);
    }
  });

  it('follows text, not labels: two editions can share one QF id', () => {
    expect(qfTranslationSelection('zh.jian')).toBe('56');
    expect(qfTranslationSelection('zh.majian')).toBe('56');
  });
});

describe('providerTranslationSelection (a fork with its own provider)', () => {
  it('keeps provider ids and moves only saheeh to Clear Quran', () => {
    expect(providerTranslationSelection('en.pickthall')).toBe('en.pickthall');
    expect(providerTranslationSelection('en.asad')).toBe('en.asad');
    expect(providerTranslationSelection('saheeh')).toBe('clear-quran');
    expect(providerTranslationSelection('clear-quran')).toBe('clear-quran');
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
