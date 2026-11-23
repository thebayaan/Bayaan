// Saving and loading reading aids per UI language, on their own.
let mockLanguage: 'en' | 'ar' = 'ar';

jest.mock('@/i18n/language', () => ({
  get currentLanguage() {
    return mockLanguage;
  },
}));

import {
  perLanguageReadingAids,
  type ReadingAidsByLanguage,
} from '../readingAidsByLanguage';

type Aid = 'showTranslation' | 'showTransliteration';
const aids = perLanguageReadingAids<Aid>([
  'showTranslation',
  'showTransliteration',
]);

/** A store's state in memory: its reading aids and another setting. */
function inMemory(
  showTranslation: boolean,
  showTransliteration: boolean,
  readingAidsInOtherLanguages: ReadingAidsByLanguage<Aid> = {},
) {
  return {
    showTranslation,
    showTransliteration,
    readingAidsInOtherLanguages,
    fontSize: 20,
  };
}

beforeEach(() => {
  mockLanguage = 'ar';
});

describe('toPersisted', () => {
  it("saves this session's values under its language, beside the others'", () => {
    const english = {showTranslation: true, showTransliteration: false};
    expect(aids.toPersisted(inMemory(true, true, {en: english}))).toEqual({
      fontSize: 20,
      readingAidsByLanguage: {
        en: english,
        ar: {showTranslation: true, showTransliteration: true},
      },
    });
  });

  it('saves under English in an English session', () => {
    mockLanguage = 'en';
    expect(aids.toPersisted(inMemory(false, true))).toEqual({
      fontSize: 20,
      readingAidsByLanguage: {
        en: {showTranslation: false, showTransliteration: true},
      },
    });
  });

  it('saves nothing for reading aids a state does not have', () => {
    expect(
      aids.toPersisted({fontSize: 20} as unknown as ReturnType<
        typeof inMemory
      >),
    ).toEqual({fontSize: 20});
  });
});

describe('merge', () => {
  it('keeps the state in memory when nothing was saved', () => {
    const current = inMemory(false, false);
    expect(aids.merge(undefined, current)).toBe(current);
    expect(aids.merge(null, current)).toBe(current);
  });

  it("loads this session's language's values, and holds the others'", () => {
    const merged = aids.merge(
      {
        fontSize: 24,
        readingAidsByLanguage: {
          en: {showTranslation: true, showTransliteration: true},
          ar: {showTranslation: true},
        },
      },
      inMemory(false, false),
    );
    expect(merged).toEqual({
      fontSize: 24,
      // Saved in Arabic: on. Not saved in Arabic: the default, off.
      showTranslation: true,
      showTransliteration: false,
      readingAidsInOtherLanguages: {
        en: {showTranslation: true, showTransliteration: true},
      },
    });
  });

  it("starts with the defaults when this language saved nothing, whatever English's", () => {
    const merged = aids.merge(
      {
        readingAidsByLanguage: {
          en: {showTranslation: true, showTransliteration: true},
        },
      },
      inMemory(false, false),
    );
    expect(merged).toMatchObject({
      showTranslation: false,
      showTransliteration: false,
    });
  });

  it('ignores values kept in the fields themselves', () => {
    const merged = aids.merge(
      {showTranslation: true, showTransliteration: true, fontSize: 24},
      inMemory(false, false),
    );
    expect(merged).toEqual({...inMemory(false, false), fontSize: 24});
  });

  it('drops languages the app does not have and values that are not booleans', () => {
    const merged = aids.merge(
      {
        readingAidsByLanguage: {
          ar: {showTranslation: 'yes', showTransliteration: true},
          xx: {showTranslation: true},
          en: 'broken',
        },
      },
      inMemory(false, false),
    );
    expect(merged).toEqual({
      ...inMemory(false, true),
      readingAidsInOtherLanguages: {en: {}},
    });
  });

  it('round-trips what toPersisted saved', () => {
    const state = inMemory(true, false, {
      en: {showTranslation: false, showTransliteration: true},
    });
    const saved = JSON.parse(JSON.stringify(aids.toPersisted(state)));
    expect(aids.merge(saved, inMemory(false, false))).toEqual(state);
  });
});

describe('moveSingleValuesToEnglish', () => {
  it('makes the single values English values, and saves none for Arabic', () => {
    const state: Record<string, unknown> = {
      showTranslation: true,
      showTransliteration: false,
      fontSize: 20,
    };
    aids.moveSingleValuesToEnglish(state);
    expect(state).toEqual({
      fontSize: 20,
      readingAidsByLanguage: {
        en: {showTranslation: true, showTransliteration: false},
      },
    });
  });

  it('leaves a missing or broken value unsaved', () => {
    const state: Record<string, unknown> = {showTranslation: 'on'};
    aids.moveSingleValuesToEnglish(state);
    expect(state).toEqual({readingAidsByLanguage: {}});
  });
});
