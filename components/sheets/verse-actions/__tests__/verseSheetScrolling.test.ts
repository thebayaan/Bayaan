/**
 * The verse sheet and its screens scroll in the sheets' list and keep the
 * sheet's drag off their bottom buttons (sheetGestures.tsx).
 *
 * The ScrollView and FlatList of react-native-actions-sheet, like React
 * Native's own, compete with the sheet's drag for every touch under Gesture
 * Handler 3: content barely scrolls, and a drag meant to scroll moves or
 * closes the sheet. Translation and Tafsir scrolled in React Native's and
 * closed when their text was dragged back down. The library's ScrollView
 * also turns its own drag tracking back on while it is open.
 */
import * as fs from 'fs';
import * as path from 'path';

const SCREENS_DIR = path.join(__dirname, '..');
// Root search, opened from a root in Word Study, lists its ayahs here.
const ROOT_RESULTS = path.join(
  SCREENS_DIR,
  '..',
  '..',
  'search',
  'quran',
  'RootResults.tsx',
);
const files = [
  path.join(SCREENS_DIR, '..', 'VerseActionsSheet.tsx'),
  ROOT_RESULTS,
  ...fs
    .readdirSync(SCREENS_DIR)
    .filter(name => name.endsWith('.tsx') && name !== 'sheetGestures.tsx')
    .map(name => path.join(SCREENS_DIR, name)),
];

/** Names a file imports from `module`. */
function importsFrom(source: string, module: string): string[] {
  const pattern = new RegExp(
    `import\\s*(?:type\\s*)?\\{([^}]*)\\}\\s*from\\s*'${module}'`,
    'g',
  );
  return [...source.matchAll(pattern)].flatMap(m =>
    m[1]
      .split(',')
      .map(name => name.replace(/^\s*type\s+/, '').trim())
      .map(name => name.split(/\s+as\s+/)[0])
      .filter(Boolean),
  );
}

const SCROLLABLES = ['ScrollView', 'FlatList', 'SectionList'];

it('finds the verse sheet and its screens', () => {
  expect(files.length).toBeGreaterThan(15);
  for (const file of files) expect(fs.existsSync(file)).toBe(true);
});

it.each(files.map(file => [path.basename(file), file]))(
  '%s scrolls in no scroll view that fights the drag',
  (_name, file) => {
    const source = fs.readFileSync(file, 'utf8');
    for (const module of ['react-native', 'react-native-actions-sheet']) {
      expect(
        importsFrom(source, module).filter(name => SCROLLABLES.includes(name)),
      ).toEqual([]);
    }
  },
);

it.each(files.map(file => [path.basename(file), file]))(
  '%s puts every FlashList on the sheet list',
  (_name, file) => {
    const source = fs.readFileSync(file, 'utf8');
    const lists = source.match(/<FlashList\b/g) ?? [];
    const onSheetList =
      source.match(/renderScrollComponent=\{SheetScrollView\}/g) ?? [];
    expect(onSheetList.length).toBe(lists.length);
  },
);

it("lists root search's ayahs in a FlashList on the sheet list", () => {
  const source = fs.readFileSync(ROOT_RESULTS, 'utf8');
  expect(source).toMatch(/<FlashList\b/);
  expect(
    importsFrom(source, '@/components/sheets/verse-actions/sheetGestures'),
  ).toContain('SheetScrollView');
});

/** The element `styles.<name>` is the style of, in `file`. */
function elementStyledBy(file: string, name: string): string[] {
  const source = fs.readFileSync(path.join(SCREENS_DIR, file), 'utf8');
  return [
    ...source.matchAll(
      new RegExp(`<(\\w+)\\s+style=\\{styles\\.${name}\\}`, 'g'),
    ),
  ].map(m => m[1]);
}

it.each([
  ['TranslationContent.tsx', 'footer'],
  ['TafseerContent.tsx', 'footer'],
  ['WordStudyContent.tsx', 'stepBar'],
  ['ShareContent.tsx', 'buttonsContainer'],
])('%s keeps the drag off its bottom buttons (%s)', (file, style) => {
  expect(elementStyledBy(file, style)).toEqual(['SheetFooter']);
});
