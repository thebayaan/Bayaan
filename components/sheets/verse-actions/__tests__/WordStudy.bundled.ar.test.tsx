// @ai-generated
/**
 * Word Study in the Arabic UI over the bundled data. The card's
 * transliteration and English meaning (and the whole-verse list's meaning)
 * follow the Word by Word options in every UI language, as the old word
 * sheet did: each is drawn when its option is on, and not when it is off.
 * The Arabic UI starts with both off (defaultShowEnglishReadingAids), and
 * with both off there is no English and no Latin letter anywhere; an option
 * turned on adds its own line and nothing else.
 *
 * The real screen, card, Readings section (over the bundled readings index),
 * i'rab blocks, Arabic meaning and rasm sections and books tab, fed by the
 * bundled word-by-word, i'rab, gharib and rasm databases and the Hafs and
 * Warsh DigitalKhatt words. Only native drawing (the grid, Skia, the
 * readings' Quran text) and word audio are replaced. The app language is
 * fixed when the app starts, so this runs in its own file.
 *
 * The only other Latin is the two web addresses the sources lines name:
 * Tanzil's terms ask for a link to tanzil.net, and quranpedia.net is the
 * publisher's address. Every digit is Arabic-Indic, behind Show more too,
 * in Word Study only mode (the unnumbered basmala) and when the i'rab
 * fails to load. @ai
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {AccessibilityInfo, Text} from 'react-native';
import i18n from 'i18next';

const ROOT = path.join(__dirname, '../../../..');

// The sheet's lists and footers as plain views: no sheet here.
jest.mock('../sheetGestures');
jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'ar'}],
}));
jest.mock('expo-sqlite', () => {
  const m = jest.requireActual('@/test-utils/mockExpoSqlite').expoSqliteModule;
  return {...m};
});
// The Hafs and Warsh DigitalKhatt words, read from the bundled files.
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const Database = jest.requireActual('better-sqlite3');
  const dir = jest
    .requireActual('path')
    .join(__dirname, '../../../../data/mushaf/digitalkhatt');
  type MockWordsDb = {
    prepare: (sql: string) => {
      all: (...args: unknown[]) => {word: number; text: string}[];
    };
  };
  const dbs: Record<string, MockWordsDb> = {
    hafs: new Database(`${dir}/digital-khatt-v2.db`, {readonly: true}),
    warsh: new Database(`${dir}/dk_words_warsh.db`, {readonly: true}),
  };
  const words = (verseKey: string, rewayah = 'hafs') => {
    const db = dbs[rewayah];
    if (!db) return null;
    const [surah, ayah] = verseKey.split(':').map(Number);
    const rows = db
      .prepare(
        'SELECT word, text FROM words WHERE surah = ? AND ayah = ? ORDER BY word',
      )
      .all(surah, ayah);
    return rows.map(row => ({
      text: row.text,
      verseKey,
      wordPositionInVerse: row.word,
    }));
  };
  return {
    digitalKhattDataService: {
      initialized: true,
      isRewayahReady: () => true,
      ensureRewayahLoaded: async () => undefined,
      subscribeCacheChanges: () => () => undefined,
      tryGetVerseWords: words,
      getVerseWords: words,
    },
    getRewayahDataIdentityKey: () => null,
  };
});
// The Readings section over the bundled readings index (dk_readings.db).
jest.mock('@/hooks/useWordReadings', () => {
  const Database = jest.requireActual('better-sqlite3');
  const format = jest.requireActual('@/services/mushaf/wordReadingsFormat');
  const db = new Database(
    jest
      .requireActual('path')
      .join(__dirname, '../../../../data/mushaf/digitalkhatt/dk_readings.db'),
    {readonly: true},
  );
  return {
    useWordReadings: (verseKey: string, wbwPosition: number) => {
      const dkPositions = format.dkPositionsForWbwWord(verseKey, wbwPosition);
      const parts = dkPositions.map((position: number) => {
        const row = db
          .prepare(
            'SELECT word_id, data FROM slots WHERE verse_key = ? AND position = ?',
          )
          .get(verseKey, position) as
          | {word_id: number; data: string}
          | undefined;
        return row
          ? format.decodeReadingsRow(verseKey, position, row.word_id, row.data)
          : format.alikeReadings(verseKey, [position]);
      });
      return {
        status: 'ready',
        readings: format.combineReadings(parts),
        dkPositions,
      };
    },
  };
});
jest.mock('../ReadingText', () => ({__esModule: true, default: () => null}));
jest.mock('@/components/sheets/AdaptiveActionSheet', () => ({
  useSheetWidth: () => 400,
}));
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/WBWVerseView',
  () => ({WBWVerseView: () => null}),
);
jest.mock('@/services/mushaf/WordReadingsService', () => ({
  wordReadingsService: {request: async () => null},
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {},
}));
jest.mock('@/hooks/useWordAudio', () => ({
  useWordAudio: () => ({state: 'idle', toggle: () => undefined}),
}));
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: () => null,
  Paragraph: () => null,
  Skia: {},
  TextAlign: {Center: 'center'},
  TextDirection: {RTL: 'rtl'},
  TextHeightBehavior: {DisableAll: 'disableAll'},
}));
jest.mock('@/utils/skiaDeferredDispose', () => ({
  disposeAfterPendingDraws: () => undefined,
}));
jest.mock('react-native-actions-sheet', () => ({
  ScrollView: jest.requireActual('react-native').View,
}));
jest.mock('react-native-reanimated', () => ({useReducedMotion: () => false}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/Icons', () => ({
  PlayIcon: () => null,
  PauseIcon: () => null,
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({useMushafFontMgr: () => null}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: false},
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
        primary: '#0a7d5a',
      },
    },
  }),
}));

import Database from 'better-sqlite3';
import {IRAB_DB_NAME} from '@/constants/bundledDatabases';
import {
  selectVerses,
  unitSelection,
} from '@/components/share/rewayahVerseSelection';
import {currentLanguage} from '@/i18n/language';
import {quotableWord} from '@/services/irab/irabFormat'; // @ai
import {irabDataService} from '@/services/irab/IrabDataService'; // @ai
import {
  buildRewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {resetDatabases, useDatabaseDir} from '@/test-utils/mockExpoSqlite';
import {WordStudyContent} from '../WordStudyContent';
import {
  hafsVerseWordParts, // @ai
  selectionWordParts,
  type WordStudySubject,
} from '../verseUnitScreens';
import type {WordRef} from '../wordStudy';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;
jest.setTimeout(30000);

// The services open these names; a copy of each bundled file is there.
const BUNDLED: Record<string, string> = {
  'wbw-en.db': 'data/wbw/wbw-en.db',
  [IRAB_DB_NAME]: `assets/data/${IRAB_DB_NAME}`,
  'gharib-v1.db': 'assets/data/gharib-v1.db',
  'rasm-v1.db': 'assets/data/rasm-v1.db',
};
/** The only other Latin allowed: the sources lines' web addresses. */
const WEB_ADDRESSES = /quranpedia\.net|tanzil\.net/g;

let dir = '';
const announced: string[] = [];

beforeAll(async () => {
  await i18n.changeLanguage('ar');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-study-ar-'));
  for (const [name, file] of Object.entries(BUNDLED)) {
    fs.copyFileSync(path.join(ROOT, file), path.join(dir, name));
  }
  useDatabaseDir(dir);
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(text => {
      announced.push(text);
    });
});

const initialSettings = useMushafSettingsStore.getInitialState();
/** The Word by Word options as the Arabic UI starts them (both off). */
const FIRST_OPTIONS = {
  wbwShowTranslation: initialSettings.wbwShowTranslation,
  wbwShowTransliteration: initialSettings.wbwShowTransliteration,
};

beforeEach(() => {
  // A test that turns an option on says so.
  useMushafSettingsStore.setState(FIRST_OPTIONS);
  announced.length = 0;
});

afterAll(async () => {
  await resetDatabases();
  fs.rmSync(dir, {recursive: true, force: true});
});

let renderer: TestRenderer.ReactTestRenderer | null = null;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

// What the app must show, read from the bundled files themselves.
const wbw = new Database(path.join(ROOT, 'data/wbw/wbw-en.db'), {
  readonly: true,
});
const dk = new Database(
  path.join(ROOT, 'data/mushaf/digitalkhatt/digital-khatt-v2.db'),
  {readonly: true},
);

afterAll(() => {
  wbw.close();
  dk.close();
});

/** A word's word-by-word lines (English and Latin). */
function gloss(verseKey: string, position: number) {
  return wbw
    .prepare(
      'SELECT translation, transliteration FROM words WHERE verse_key = ? AND position = ?',
    )
    .get(verseKey, position) as {translation: string; transliteration: string};
}

/** The mushaf's (DigitalKhatt) text of a Hafs word slot. */
function mushaf(verseKey: string, word: number): string {
  const [surah, ayah] = verseKey.split(':').map(Number);
  const row = dk
    .prepare('SELECT text FROM words WHERE surah = ? AND ayah = ? AND word = ?')
    .get(surah, ayah, word) as {text: string};
  return row.text;
}

function hafs(verseKey: string): WordStudySubject {
  const [surahNumber, ayahNumber] = verseKey.split(':').map(Number);
  const selection = selectVerses(
    {rewayah: 'hafs', verseKey, surahNumber, ayahNumber},
    null,
    'ready',
  );
  if (selection.status !== 'ready') throw new Error('not ready');
  return {rewayah: 'hafs', parts: selectionWordParts(selection)};
}

const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    ids: number[];
    locations: string[];
    texts: {warsh: string[]};
  };
const warshUnits = buildRewayahVerseUnits(
  'warsh',
  fixture.ids.map((id, i): VerseUnitSlot => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts.warsh[i]};
  }),
  'warsh@test',
);

function warsh(verseKey: string): WordStudySubject {
  const unit = warshUnits.unitByKey(verseKey);
  if (!unit) throw new Error(`no Warsh ${verseKey}`);
  return {
    rewayah: 'warsh',
    parts: selectionWordParts(unitSelection(warshUnits, [unit])),
  };
}

async function settle() {
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
}

async function open(study: WordStudySubject, initialWord?: WordRef) {
  act(() => {
    renderer = TestRenderer.create(
      <WordStudyContent
        study={study}
        initialWord={initialWord}
        onRootPress={() => undefined}
      />,
    );
  });
  await settle();
}

function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

/** Every Text's own strings, joined per Text. */
function texts(): string[] {
  return root()
    .findAll(n => (n.type as unknown) === Text)
    .map(n =>
      [n.props.children]
        .flat(Infinity)
        .filter(
          (c): c is string | number =>
            typeof c === 'string' || typeof c === 'number',
        )
        .join(''),
    )
    .filter(Boolean);
}

/** Every string a screen reader is given. */
function spoken(): string[] {
  return root()
    .findAll(() => true)
    .flatMap(n => [
      n.props.accessibilityLabel,
      n.props.accessibilityHint,
      n.props.accessibilityValue?.text,
    ])
    .filter((s): s is string => typeof s === 'string' && s !== '');
}

/**
 * What is shown or spoken that holds Latin or ASCII digits, outside the web
 * addresses and the `allowed` word-by-word lines the reader turned on.
 * Longest lines first: 'Him' is a meaning, and so is 'overtakes Him'.
 */
function notArabic(allowed: readonly string[] = []): string[] {
  const lines = [...allowed].sort((a, b) => b.length - a.length);
  return [...texts(), ...spoken(), ...announced].filter(s => {
    let rest = s.replace(WEB_ADDRESSES, '');
    for (const line of lines) rest = rest.split(line).join('');
    return /[A-Za-z0-9]/.test(rest);
  });
}

async function press(label: string) {
  const found = root().findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      (n.props.accessibilityLabel === label ||
        n.findAll(c => c.props.children === label).length > 0),
  );
  if (!found.length) throw new Error(`nothing to press: ${label}`);
  await act(async () => found[found.length - 1].props.onPress());
  await settle();
}

it('runs in the Arabic UI, with both Word by Word options off at first', () => {
  expect(currentLanguage).toBe('ar');
  expect(FIRST_OPTIONS).toEqual({
    wbwShowTranslation: false,
    wbwShowTransliteration: false,
  });
});

it('shows no transliteration or English meaning with the Word by Word options off', async () => {
  const allah = gloss('2:255', 1);
  // The data has both lines for the word.
  expect(allah.transliteration).toBe('al-lahu');
  expect(allah.translation.trim()).toBe('Allah');
  await open(hafs('2:255'), {verseKey: '2:255', position: 1});
  const shown = texts();
  expect(shown).toEqual(
    expect.arrayContaining([
      mushaf('2:255', 1),
      '٢:٢٥٥ · الكلمة ١',
      'الإعراب',
      'الصرف',
      'القراءات',
      'الكلمة ١ من ٥٠',
    ]),
  );
  const all = shown.join('|');
  expect(all).not.toContain(allah.transliteration);
  expect(all).not.toContain(allah.translation.trim());
  expect(notArabic()).toEqual([]);

  // Stepping announces the next word in Arabic.
  await press('الكلمة التالية');
  expect(texts()).toContain('الكلمة ٢ من ٥٠');
  expect(announced).toEqual([`${mushaf('2:255', 2)}، الكلمة ٢ من ٥٠`]);
  expect(notArabic()).toEqual([]);
});

it.each([
  [true, true],
  [true, false],
  [false, true],
])(
  'shows the Word by Word lines the reader turned on (translation %s, transliteration %s)',
  async (translation, transliteration) => {
    useMushafSettingsStore.setState({
      wbwShowTranslation: translation,
      wbwShowTransliteration: transliteration,
    });
    const allah = gloss('2:255', 1);
    const meaning = allah.translation.trim();
    await open(hafs('2:255'), {verseKey: '2:255', position: 1});
    const shown = texts();
    expect(shown.includes(allah.transliteration)).toBe(transliteration);
    // In quotes, without the data's trailing space.
    expect(shown.join('|').includes(`“${meaning}”`)).toBe(translation);
    expect(shown.join('|').includes(meaning)).toBe(translation);
    // The rest of the card is as with the options off, and all Arabic.
    expect(shown).toEqual(
      expect.arrayContaining([
        mushaf('2:255', 1),
        '٢:٢٥٥ · الكلمة ١',
        'الإعراب',
        'الصرف',
        'القراءات',
        'الكلمة ١ من ٥٠',
      ]),
    );
    expect(notArabic([allah.transliteration, meaning])).toEqual([]);
  },
);

it('lists the whole verse without the English meanings while the Translation option is off', async () => {
  await open(hafs('2:255'), {verseKey: '2:255', position: 1});
  await press('الآية كاملة');
  const shown = texts();
  expect(shown).toEqual(
    expect.arrayContaining(['كلمة واحدة', 'الكلمة ١', 'الكلمة ٥٠']),
  );
  expect(shown.join('|')).not.toContain('Allah');
  expect(notArabic()).toEqual([]);
});

it("lists the whole verse with each word's English meaning once the Translation option is on", async () => {
  useMushafSettingsStore.setState({wbwShowTranslation: true});
  const meanings = (
    wbw
      .prepare(
        'SELECT translation FROM words WHERE verse_key = ? ORDER BY position',
      )
      .all('2:255') as {translation: string}[]
  )
    .map(row => row.translation.trim())
    .filter(Boolean);
  expect(meanings).toHaveLength(50);
  await open(hafs('2:255'), {verseKey: '2:255', position: 1});
  await press('الآية كاملة');
  const shown = texts();
  // Each word's meaning, trimmed ('Allah ' at 2:255:1 in the data).
  expect(shown).toEqual(
    expect.arrayContaining([
      'كلمة واحدة',
      'الكلمة ١',
      'الكلمة ٥٠',
      ...meanings,
    ]),
  );
  // No transliteration in the list, and nothing else in Latin.
  expect(shown.join('|')).not.toContain(gloss('2:255', 1).transliteration);
  expect(notArabic(meanings)).toEqual([]);
});

it("names a word of another verse in Arabic, with its verse, in 1:4:1's i'rab", async () => {
  await open(hafs('1:4'), {verseKey: '1:4', position: 1});
  const shown = texts();
  // 1:4:1 is a substitute of 1:2:2, quoted in the mushaf's own text.
  expect(shown).toContain(
    `بدل من ⁨«${mushaf('1:2', 2)}» (١:٢)⁩ مجرور وعلامة جره الكسرة`,
  );
  // Its readings differ, and it has a rasm note.
  expect(shown).toEqual(
    expect.arrayContaining(['تختلف قراءتها بين الروايات', 'الرسم']),
  );
  expect(gloss('1:4', 1).transliteration).toBe('māliki');
  expect(shown.join('|')).not.toContain('māliki');
  expect(notArabic()).toEqual([]);
  // The rasm source keeps its web address, and no other Latin.
  expect(shown.join('|')).toContain('tanzil.net');
  // The other morphology facts, behind Show more. @ai
  await press('عرض المزيد');
  expect(texts()).toEqual(expect.arrayContaining(['عرض أقل', 'الاشتقاق']));
  expect(notArabic()).toEqual([]);
});

it("names the sources in Arabic only, past the web addresses (1:7:2's Arabic meaning)", async () => {
  await open(hafs('1:7'), {verseKey: '1:7', position: 2});
  const shown = texts();
  expect(shown).toContain('معنى الكلمة');
  expect(shown.join('|')).toContain('quranpedia.net');
  const sources = shown.find(s => s.startsWith('إعراب الكلمات'));
  expect(sources).toBeDefined();
  expect(sources).not.toMatch(/[A-Za-z]/);
  expect(notArabic()).toEqual([]);
});

it('shows the books tab in Arabic', async () => {
  await open(hafs('2:255'), {verseKey: '2:255', position: 1});
  await press('كتب الإعراب');
  expect(texts()).toEqual(
    expect.arrayContaining([
      'التبيان في إعراب القرآن',
      'النص من الموسوعة القرآنية (quranpedia.net).',
    ]),
  );
  expect(notArabic()).toEqual([]);
});

it('shows another rewayah in Arabic: the Hafs chip and note, Hafs verse names', async () => {
  await open(warsh('1:6'));
  const shown = texts();
  expect(shown).toEqual(
    expect.arrayContaining([
      'حفص',
      'حفص ١:٧',
      'حفص ١:٧ · الكلمة ١',
      'المعاني والنطق والإعراب والصرف والرسم على رواية حفص، وتبيّن «القراءات» قراءة رواية ورش.',
      // Hafs 1:7:1 is a substitute of Hafs 1:6:2.
      `بدل من ⁨«${mushaf('1:6', 2)}» (حفص ١:٦)⁩ منصوب وعلامة نصبه الفتحة`,
    ]),
  );
  expect(notArabic()).toEqual([]);
  await press('الآية كاملة');
  expect(notArabic()).toEqual([]);
});

it("writes a lemma's homonym number in Arabic-Indic digits", async () => {
  // 43:77:2 (يَٰمَٰلِكُ): the corpus lemma is مَٰلِك2, a second مَٰلِك.
  await open(hafs('43:77'), {verseKey: '43:77', position: 2});
  expect(texts()).toEqual(expect.arrayContaining(['الأصل المعجمي', 'مَٰلِك٢']));
  expect(notArabic()).toEqual([]);
  await press('عرض المزيد'); // @ai
  expect(notArabic()).toEqual([]);
});

// @ai-start
it("names another verse's word in Arabic behind Show more (16:44:12's object, 16:45:5)", async () => {
  await open(hafs('16:44'), {verseKey: '16:44', position: 12});
  await press('عرض المزيد');
  expect(texts()).toContain(
    `متعدٍّ، ومفعوله ⁨«${quotableWord(mushaf('16:45', 5))}» (١٦:٤٥)⁩`,
  );
  expect(notArabic()).toEqual([]);
});

it("shows Word Study only mode (Warsh's unnumbered basmala) in Arabic", async () => {
  await open({rewayah: 'warsh', parts: hafsVerseWordParts(['1:1'], 'warsh')});
  expect(texts()).toEqual(
    expect.arrayContaining(['حفص ١:١', 'حفص ١:١ · الكلمة ١', 'الكلمة ١ من ٤']),
  );
  await press('عرض المزيد');
  expect(notArabic()).toEqual([]);
  for (const n of ['٢', '٣', '٤']) {
    await press('الكلمة التالية');
    expect(texts()).toContain(`الكلمة ${n} من ٤`);
    expect(notArabic()).toEqual([]);
  }
  // 1:1:4 is an adjective of word 2 of its own verse: quoted, no verse named.
  expect(texts()).toContain(`«${mushaf('1:1', 2)}»`);
  await press('الآية كاملة');
  expect(notArabic()).toEqual([]);
  await press('كتب الإعراب');
  expect(notArabic()).toEqual([]);
});

it("says in Arabic that the i'rab failed to load", async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const getVerse = jest
    .spyOn(irabDataService, 'getVerse')
    .mockRejectedValueOnce(new Error('disk'));
  try {
    await open(hafs('1:4'), {verseKey: '1:4', position: 1});
    expect(texts()).toContain('تعذّر تحميل الإعراب.');
    expect(notArabic()).toEqual([]);
    await press('الآية كاملة');
    expect(texts()).toContain('تعذّر تحميل الإعراب.');
    expect(notArabic()).toEqual([]);
  } finally {
    getVerse.mockRestore();
    warn.mockRestore();
  }
});
// @ai-end
