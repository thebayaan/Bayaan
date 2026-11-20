// @ai-generated
/**
 * Word Study end to end over the bundled data: the real screen, card,
 * i'rab blocks and Arabic meaning / rasm sections, fed by the real
 * word-by-word, i'rab and word-study services reading copies of the
 * bundled databases (through the expo-sqlite test mock), and the Hafs
 * DigitalKhatt words of digital-khatt-v2.db. Only native drawing (the
 * word grid, Skia), word audio and the readings section are replaced.
 *
 * It checks what the parts only show together: 2:4:9, whose word-by-word
 * text is damaged, is shown and quoted in the mushaf's own text; its i'rab
 * references open the words they name; its Arabic meaning quotes the words
 * it explains; 1:4:1 shows its root, lemma and rasm; stepping crosses from
 * one verse into the next; 2:255:1's meaning is quoted without the data's
 * trailing space; a word of another verse is named by its number while the
 * Hafs words are out of memory, and quoted once they are back. @ai
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text} from 'react-native';

const ROOT = path.join(__dirname, '../../../..');
/** Whether the Hafs words are in memory, and who listens (setHafsInMemory). @ai */
const mockHafs = {inMemory: true, listeners: new Set<() => void>()};

// The sheet's lists and footers as plain views: no sheet here.
jest.mock('../sheetGestures');
jest.mock('expo-sqlite', () => {
  const m = jest.requireActual('@/test-utils/mockExpoSqlite').expoSqliteModule;
  return {...m};
});
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const Database = jest.requireActual('better-sqlite3');
  const file = jest
    .requireActual('path')
    .join(
      __dirname,
      '../../../../data/mushaf/digitalkhatt/digital-khatt-v2.db',
    );
  const db = new Database(file, {readonly: true});
  const words = (verseKey: string) => {
    const [surah, ayah] = verseKey.split(':').map(Number);
    return (
      db
        .prepare(
          'SELECT word, text FROM words WHERE surah = ? AND ayah = ? ORDER BY word',
        )
        .all(surah, ayah) as {word: number; text: string}[]
    ).map(row => ({text: row.text, verseKey, wordPositionInVerse: row.word}));
  };
  return {
    digitalKhattDataService: {
      initialized: true,
      // @ai-start
      // As the service: null while the Hafs words are not in memory, and a
      // cache change tells the subscribers.
      isRewayahReady: () => mockHafs.inMemory,
      ensureRewayahLoaded: async () => undefined,
      subscribeCacheChanges: (listener: () => void) => {
        mockHafs.listeners.add(listener);
        return () => {
          mockHafs.listeners.delete(listener);
        };
      },
      tryGetVerseWords: (verseKey: string) =>
        mockHafs.inMemory ? words(verseKey) : null,
      // @ai-end
      getVerseWords: words,
    },
    getRewayahDataIdentityKey: () => null,
  };
});
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/WBWVerseView',
  () => ({WBWVerseView: () => null}),
);
jest.mock('../WordReadingsSection', () => ({WordReadingsSection: () => null}));
jest.mock('@/services/mushaf/WordReadingsService', () => ({
  wordReadingsService: {request: async () => null},
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
  decodeMorph,
  MORPH_LEMMA_LABEL,
  MORPH_ROOT_LABEL,
  quotableWord, // @ai
} from '@/services/irab/irabFormat';
import {selectVerses} from '@/components/share/rewayahVerseSelection';
import {useDatabaseDir, resetDatabases} from '@/test-utils/mockExpoSqlite';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore'; // @ai
import {WordStudyContent} from '../WordStudyContent';
import type {WordRef} from '../wordStudy';
import {selectionWordParts, type WordStudySubject} from '../verseUnitScreens'; // @ai

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

// The services open these names; a copy of each bundled file is there.
const BUNDLED: Record<string, string> = {
  'wbw-en.db': 'data/wbw/wbw-en.db',
  [IRAB_DB_NAME]: `assets/data/${IRAB_DB_NAME}`,
  'gharib-v1.db': 'assets/data/gharib-v1.db',
  'rasm-v1.db': 'assets/data/rasm-v1.db',
};
let dir = '';

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-study-'));
  for (const [name, file] of Object.entries(BUNDLED)) {
    fs.copyFileSync(path.join(ROOT, file), path.join(dir, name));
  }
  useDatabaseDir(dir);
  // The card shows the Word by Word lines the reader turned on: both. @ai
  useMushafSettingsStore.setState({
    wbwShowTranslation: true,
    wbwShowTransliteration: true,
  });
});

afterAll(async () => {
  await resetDatabases();
  fs.rmSync(dir, {recursive: true, force: true});
});

let renderer: TestRenderer.ReactTestRenderer | null = null;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  mockHafs.inMemory = true; // @ai
});

// The words of these Hafs verses, as the sheet gives them to Word Study. @ai
function hafs(...verseKeys: string[]): WordStudySubject {
  const [surahNumber, ayahNumber] = verseKeys[0].split(':').map(Number);
  const selection = selectVerses(
    {
      rewayah: 'hafs',
      verseKey: verseKeys[0],
      surahNumber,
      ayahNumber,
      verseKeys: verseKeys.length > 1 ? verseKeys : undefined,
    },
    null,
    'ready',
  );
  if (selection.status !== 'ready') throw new Error('not ready');
  return {rewayah: 'hafs', parts: selectionWordParts(selection)}; // @ai
}

async function open(verseKeys: string[], initialWord?: WordRef) {
  act(() => {
    renderer = TestRenderer.create(
      <WordStudyContent
        study={hafs(...verseKeys)} // @ai
        initialWord={initialWord}
      />,
    );
  });
  // The databases answer asynchronously (better-sqlite3 behind promises).
  await settle();
}

function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

/** Every string drawn in a Text. */
function texts(): string[] {
  return root()
    .findAll(n => (n.type as unknown) === Text)
    .flatMap(n =>
      [n.props.children]
        .flat(Infinity)
        .filter((c): c is string => typeof c === 'string'),
    );
}

/** The tappable reference «word» in the i'rab text. */
function reference(quoted: string): TestRenderer.ReactTestInstance {
  const found = root().findAll(
    n =>
      (n.type as unknown) === Text &&
      typeof n.props.onPress === 'function' &&
      n.props.children === quoted,
  );
  if (found.length === 0) throw new Error(`no reference ${quoted}`);
  return found[0];
}

// What the app must show, read from the bundled files themselves (never
// retyped: DigitalKhatt writes hamza and shadda in its own order).
const dk = new Database(
  path.join(ROOT, 'data/mushaf/digitalkhatt/digital-khatt-v2.db'),
  {readonly: true},
);
const irab = new Database(path.join(ROOT, 'assets/data', IRAB_DB_NAME), {
  readonly: true,
});
const irabTexts: string[] = [];
for (const r of irab.prepare('SELECT id, text FROM texts').all() as {
  id: number;
  text: string;
}[]) {
  irabTexts[r.id] = r.text;
}

/** The mushaf's (DigitalKhatt) text of a Hafs word slot. */
function mushaf(verseKey: string, word: number): string {
  const [surah, ayah] = verseKey.split(':').map(Number);
  const row = dk
    .prepare('SELECT text FROM words WHERE surah = ? AND ayah = ? AND word = ?')
    .get(surah, ayah, word) as {text: string};
  return row.text;
}

/** A word's morphology value by label, from the bundled i'rab. */
function morph(verseKey: string, position: number, label: string): string {
  const row = irab
    .prepare('SELECT morph FROM word_irab WHERE verse_key = ? AND position = ?')
    .get(verseKey, position) as {morph: string};
  const fact = decodeMorph(row.morph, irabTexts).find(f => f.label === label);
  if (!fact) throw new Error(`${verseKey}:${position} has no ${label}`);
  return fact.value;
}

afterAll(() => {
  dk.close();
  irab.close();
});

async function settle() {
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
}

it("shows 2:4:9 in the mushaf's own text, never the damaged word-by-word text", async () => {
  await open(['2:4'], {verseKey: '2:4', position: 9});
  const shown = texts();
  expect(shown.join('|')).not.toContain('�');
  expect(shown).toEqual(
    expect.arrayContaining([
      // The header word (React Native Text until the font manager is up).
      mushaf('2:4', 9),
      'qablika',
      '“before you”',
      '2:4 · word 9',
      'Word 9 of 12',
      "I'rab",
      'Morphology (ṣarf)',
      morph('2:4', 9, MORPH_ROOT_LABEL),
      morph('2:4', 9, MORPH_LEMMA_LABEL),
    ]),
  );
  // Its i'rab quotes the words it names (8 and 7) in the mushaf's text,
  // and they open.
  const word8 = `«${mushaf('2:4', 8)}»`;
  expect(shown).toEqual(
    expect.arrayContaining([word8, `«${mushaf('2:4', 7)}»`]),
  );
  await act(async () => reference(word8).props.onPress());
  await settle();
  expect(texts()).toEqual(
    expect.arrayContaining([mushaf('2:4', 8), '2:4 · word 8', 'Word 8 of 12']),
  );
});

it("quotes the words an Arabic meaning explains, in the mushaf's text", async () => {
  await open(['2:4'], {verseKey: '2:4', position: 9});
  const shown = texts();
  expect(shown).toContain('Arabic meaning');
  // The al-Tibyan entry of 2:4 placed on its words 6-9.
  const span = [6, 7, 8, 9].map(w => mushaf('2:4', w)).join(' ');
  expect(shown).toContain(`«${span}» `);
});

it('shows the root, the lemma and the rasm of 1:4:1, and steps into 1:5', async () => {
  await open(['1:4', '1:5'], {verseKey: '1:4', position: 1});
  const shown = texts();
  expect(shown).toEqual(
    expect.arrayContaining([
      morph('1:4', 1, MORPH_ROOT_LABEL),
      morph('1:4', 1, MORPH_LEMMA_LABEL),
      'Rasm',
      // The rasm's Mushaf row is the mushaf's own text.
      mushaf('1:4', 1),
      'Word 1 of 7',
    ]),
  );
  for (let i = 0; i < 3; i++) {
    const next = root().find(
      n =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === 'Next word',
    );
    await act(async () => next.props.onPress());
  }
  await settle();
  expect(texts()).toEqual(
    expect.arrayContaining([mushaf('1:5', 1), '1:5 · word 1', 'Word 4 of 7']),
  );
});

/** The value beside a rasm row's label ('Mushaf', 'Standard'). */
function rasmRow(label: string): string {
  const labelText = root().find(
    n => (n.type as unknown) === Text && n.props.children === label,
  );
  const row = labelText.parent;
  if (!row) throw new Error(`no row for ${label}`);
  const value = row.findAll(
    n => (n.type as unknown) === Text && n !== labelText,
  )[0];
  return [value.props.children]
    .flat(Infinity)
    .filter((c): c is string => typeof c === 'string')
    .join('');
}

it('keeps the small high seen of 2:245:14 in its rasm Mushaf row and in the quote of its Arabic meaning', async () => {
  await open(['2:245'], {verseKey: '2:245', position: 14});
  // The small high seen over its sad, which its rasm note rests on.
  const word = mushaf('2:245', 14);
  expect(word).toContain('\u06dc');
  // The slot has no pause mark: its rasm Mushaf row is its text exactly.
  expect(rasmRow('Mushaf')).toBe(word);
  // The al-Tibyan entry placed on its words 13-14 quotes both.
  expect(texts()).toContain(`«${mushaf('2:245', 13)} ${word}» `);
});

// @ai-start
/** The Hafs words leave memory (another rewayah's load evicted them) or come back. */
function setHafsInMemory(inMemory: boolean) {
  act(() => {
    mockHafs.inMemory = inMemory;
    for (const listener of [...mockHafs.listeners]) listener();
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

it("quotes 2:255:1's meaning without the data's trailing space", async () => {
  await open(['2:255'], {verseKey: '2:255', position: 1});
  expect(texts()).toEqual(expect.arrayContaining(['al-lahu', '“Allah”']));
});

it('names a word of another verse by number while the Hafs words are out of memory, and quotes it once they are back', async () => {
  // 16:44:12: a phrase of its i'rab names word 11 of its own verse, and its
  // object (behind Show more) is 16:45:5.
  await open(['16:44'], {verseKey: '16:44', position: 12});
  await press('Show more');
  const own = `«${quotableWord(mushaf('16:44', 11))}»`;
  const quoted = `\u2068«${quotableWord(mushaf('16:45', 5))}» (16:45)\u2069`;
  const numbered = '\u2068word 5 (16:45)\u2069';
  expect(texts()).toEqual(expect.arrayContaining([own, quoted]));
  expect(texts()).not.toContain(numbered);

  setHafsInMemory(false);
  // The selection's own words were read when it loaded: still quoted.
  expect(texts()).toEqual(expect.arrayContaining([own, numbered]));
  expect(texts()).not.toContain(quoted);

  setHafsInMemory(true);
  expect(texts()).toEqual(expect.arrayContaining([own, quoted]));
  expect(texts()).not.toContain(numbered);
});
// @ai-end
