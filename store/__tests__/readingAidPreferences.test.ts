// @ai-generated
// The English reading aids keep a value for each UI language. In Arabic all
// start off, and a reader who turns one on there keeps it there; English
// keeps its own values. Each launch below is a new session in one language
// over what the previous launches saved.
const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    mockStorage.delete(key);
  },
}));

type Language = 'en' | 'ar';

/** Starts the app in `language`: fresh stores reading what was saved. */
async function launch(language: Language) {
  jest.doMock('@/i18n/language', () => ({
    currentLanguage: language,
    defaultShowEnglishReadingAids: language === 'en',
    defaultShowTransliteration: language === 'en',
  }));
  let mushaf!: typeof import('../mushafSettingsStore').useMushafSettingsStore;
  let adhkar!: typeof import('../adhkarSettingsStore').useAdhkarSettingsStore;
  jest.isolateModules(() => {
    mushaf = require('../mushafSettingsStore').useMushafSettingsStore;
    adhkar = require('../adhkarSettingsStore').useAdhkarSettingsStore;
  });
  await Promise.all([mushaf.persist.rehydrate(), adhkar.persist.rehydrate()]);
  return {mushaf, adhkar};
}

type App = Awaited<ReturnType<typeof launch>>;

/** The reading aids each store shows. */
function readingAids({mushaf, adhkar}: App) {
  const m = mushaf.getState();
  const a = adhkar.getState();
  return {
    mushaf: {
      showTranslation: m.showTranslation,
      showTransliteration: m.showTransliteration,
      wbwShowTranslation: m.wbwShowTranslation,
      wbwShowTransliteration: m.wbwShowTransliteration,
    },
    adhkar: {
      showTranslation: a.showTranslation,
      showTransliteration: a.showTransliteration,
    },
  };
}

const ALL_OFF = {
  mushaf: {
    showTranslation: false,
    showTransliteration: false,
    wbwShowTranslation: false,
    wbwShowTransliteration: false,
  },
  adhkar: {showTranslation: false, showTransliteration: false},
};

const ALL_ON = {
  mushaf: {
    showTranslation: true,
    showTransliteration: true,
    wbwShowTranslation: true,
    wbwShowTransliteration: true,
  },
  adhkar: {showTranslation: true, showTransliteration: true},
};

/** English's defaults, the same as before reading aids were per language. */
const ENGLISH_DEFAULTS = {
  mushaf: {
    showTranslation: true,
    showTransliteration: false,
    wbwShowTranslation: true,
    wbwShowTransliteration: false,
  },
  adhkar: {showTranslation: true, showTransliteration: true},
};

/** Sets every reading aid as `values` says, as the settings toggles do. */
function choose(app: App, values: typeof ALL_ON): void {
  const m = app.mushaf.getState();
  const a = app.adhkar.getState();
  if (m.showTranslation !== values.mushaf.showTranslation) {
    m.toggleTranslation();
  }
  if (m.showTransliteration !== values.mushaf.showTransliteration) {
    m.toggleTransliteration();
  }
  if (m.wbwShowTranslation !== values.mushaf.wbwShowTranslation) {
    m.toggleWBWTranslation();
  }
  if (m.wbwShowTransliteration !== values.mushaf.wbwShowTransliteration) {
    m.toggleWBWTransliteration();
  }
  if (a.showTranslation !== values.adhkar.showTranslation) {
    a.toggleTranslation();
  }
  if (a.showTransliteration !== values.adhkar.showTransliteration) {
    a.toggleTransliteration();
  }
  // Saved even where nothing changed, as any other change would save it.
  app.mushaf.setState({});
  app.adhkar.setState({});
  expect(readingAids(app)).toEqual(values);
}

/** What a store saved, as written to storage. */
function saved(key: 'mushaf-settings' | 'adhkar-settings') {
  const raw = mockStorage.get(key);
  if (!raw) throw new Error(`nothing saved under ${key}`);
  return JSON.parse(raw) as {state: Record<string, unknown>; version: number};
}

/** Saves the stores as the release before per-language values did. */
function saveFromLastRelease(
  mushafState: Record<string, unknown>,
  adhkarState: Record<string, unknown>,
  mushafVersion = 21,
): void {
  mockStorage.set(
    'mushaf-settings',
    JSON.stringify({version: mushafVersion, state: mushafState}),
  );
  mockStorage.set(
    'adhkar-settings',
    JSON.stringify({version: 0, state: adhkarState}),
  );
}

beforeEach(() => mockStorage.clear());

describe('a fresh install', () => {
  it('starts every English reading aid off in Arabic', async () => {
    expect(readingAids(await launch('ar'))).toEqual(ALL_OFF);
  });

  it("starts with English's defaults in English, as before", async () => {
    expect(readingAids(await launch('en'))).toEqual(ENGLISH_DEFAULTS);
  });
});

describe('a change of UI language', () => {
  it('turns every English reading aid off when an English install with them on switches to Arabic', async () => {
    choose(await launch('en'), ALL_ON);
    expect(readingAids(await launch('ar'))).toEqual(ALL_OFF);
  });

  it("keeps an Arabic reader's choice after a relaunch, and English its own value", async () => {
    const english = await launch('en');
    english.mushaf.getState().toggleWBWTranslation(); // English: off
    expect(english.mushaf.getState().wbwShowTranslation).toBe(false);

    const arabic = await launch('ar');
    expect(arabic.mushaf.getState().wbwShowTranslation).toBe(false);
    arabic.mushaf.getState().toggleWBWTranslation(); // Arabic: on
    expect((await launch('ar')).mushaf.getState().wbwShowTranslation).toBe(
      true,
    );

    expect((await launch('en')).mushaf.getState().wbwShowTranslation).toBe(
      false,
    );
  });

  it('lets Arabic readers turn every reading aid on, and keeps them on', async () => {
    choose(await launch('ar'), ALL_ON);
    expect(readingAids(await launch('ar'))).toEqual(ALL_ON);
  });

  it("leaves English's values as they were after a session in Arabic", async () => {
    const mixed = {
      mushaf: {
        showTranslation: false,
        showTransliteration: true,
        wbwShowTranslation: true,
        wbwShowTransliteration: true,
      },
      adhkar: {showTranslation: false, showTransliteration: true},
    };
    choose(await launch('en'), mixed);

    const arabic = await launch('ar');
    expect(readingAids(arabic)).toEqual(ALL_OFF);
    choose(arabic, ALL_ON);
    choose(arabic, {
      ...ALL_OFF,
      mushaf: {...ALL_OFF.mushaf, wbwShowTranslation: true},
    });

    expect(readingAids(await launch('en'))).toEqual(mixed);
    expect(readingAids(await launch('ar'))).toEqual({
      ...ALL_OFF,
      mushaf: {...ALL_OFF.mushaf, wbwShowTranslation: true},
    });
  });

  it('saves each language under its code, and nothing in the old fields', async () => {
    choose(await launch('en'), ALL_ON);
    choose(await launch('ar'), ALL_OFF);

    const mushaf = saved('mushaf-settings');
    expect(mushaf.version).toBe(22);
    expect(mushaf.state.readingAidsByLanguage).toEqual({
      en: ALL_ON.mushaf,
      ar: ALL_OFF.mushaf,
    });
    const adhkar = saved('adhkar-settings');
    expect(adhkar.version).toBe(1);
    expect(adhkar.state.readingAidsByLanguage).toEqual({
      en: ALL_ON.adhkar,
      ar: ALL_OFF.adhkar,
    });
    for (const state of [mushaf.state, adhkar.state]) {
      expect(state).not.toHaveProperty('showTranslation');
      expect(state).not.toHaveProperty('showTransliteration');
      expect(state).not.toHaveProperty('wbwShowTranslation');
      expect(state).not.toHaveProperty('wbwShowTransliteration');
      expect(state).not.toHaveProperty('readingAidsInOtherLanguages');
    }
  });
});

describe('an English-only reader', () => {
  it.each([
    ['all on', ALL_ON],
    ['all off', ALL_OFF],
  ])(
    'keeps the reading aids chosen (%s) after a relaunch',
    async (_, values) => {
      choose(await launch('en'), values);
      expect(readingAids(await launch('en'))).toEqual(values);
    },
  );

  it('keeps the other settings saved beside them', async () => {
    const app = await launch('en');
    app.mushaf.getState().setArabicFontSize(30);
    app.adhkar.getState().setTranslationFontSize(18);
    app.mushaf.getState().toggleTransliteration();

    const relaunched = await launch('en');
    expect(relaunched.mushaf.getState()).toMatchObject({
      arabicFontSize: 30,
      showTransliteration: true,
    });
    expect(relaunched.adhkar.getState().translationFontSize).toBe(18);
  });
});

describe('settings saved before reading aids were per language', () => {
  const ALL_ON_SAVED = {
    mushaf: {
      showTranslation: true,
      showTransliteration: true,
      wbwShowTranslation: true,
      wbwShowTransliteration: true,
    },
    adhkar: {showTranslation: true, showTransliteration: true},
  };

  it('become English values: all off in Arabic, all kept in English', async () => {
    saveFromLastRelease(
      {...ALL_ON_SAVED.mushaf, arabicFontSize: 30},
      {...ALL_ON_SAVED.adhkar, arabicFontSize: 34},
    );
    const arabic = await launch('ar');
    expect(readingAids(arabic)).toEqual(ALL_OFF);
    // The other settings are kept.
    expect(arabic.mushaf.getState().arabicFontSize).toBe(30);
    expect(arabic.adhkar.getState().arabicFontSize).toBe(34);
    // Saved at once in the new shape: the next launch reads it.
    expect(saved('mushaf-settings').version).toBe(22);
    expect(saved('adhkar-settings').version).toBe(1);

    expect(readingAids(await launch('en'))).toEqual(ALL_ON);
    expect(readingAids(await launch('ar'))).toEqual(ALL_OFF);
  });

  it('are unchanged for an install that runs in English', async () => {
    const before = {
      mushaf: {
        showTranslation: false,
        showTransliteration: true,
        wbwShowTranslation: true,
        wbwShowTransliteration: false,
      },
      adhkar: {showTranslation: true, showTransliteration: false},
    };
    saveFromLastRelease(before.mushaf, before.adhkar);
    expect(readingAids(await launch('en'))).toEqual(before);
    expect(readingAids(await launch('en'))).toEqual(before);
  });

  it("start English's defaults for a setting an older version did not have", async () => {
    // Version 7 had no Word by Word.
    saveFromLastRelease(
      {showTranslation: false, showTransliteration: true},
      {},
      7,
    );
    expect(readingAids(await launch('ar'))).toEqual(ALL_OFF);
    expect(readingAids(await launch('en'))).toEqual({
      mushaf: {
        showTranslation: false,
        showTransliteration: true,
        wbwShowTranslation: true,
        wbwShowTransliteration: false,
      },
      adhkar: ENGLISH_DEFAULTS.adhkar,
    });
  });

  it('ignore a value that is not a boolean', async () => {
    saveFromLastRelease(
      {showTranslation: 'yes', wbwShowTranslation: null},
      {showTransliteration: 1},
    );
    expect(readingAids(await launch('en'))).toEqual(ENGLISH_DEFAULTS);
  });
});

describe('the migrations', () => {
  it.each([null, undefined, 'broken'])(
    'survive a saved state that is not an object (%s)',
    async state => {
      const {mushaf, adhkar} = await launch('en');
      const mushafMigrate = mushaf.persist.getOptions().migrate;
      const adhkarMigrate = adhkar.persist.getOptions().migrate;
      if (!mushafMigrate || !adhkarMigrate) throw new Error('no migrate');
      expect(await mushafMigrate(state, 5)).toMatchObject({
        readingAidsByLanguage: {},
      });
      expect(await adhkarMigrate(state, 0)).toEqual({
        readingAidsByLanguage: {},
      });
    },
  );
});
