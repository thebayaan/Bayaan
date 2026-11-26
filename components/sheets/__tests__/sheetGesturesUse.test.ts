/**
 * Sheets scroll with SheetScrollView and SheetFlatList, and hold the
 * buttons they end with in a SheetFooter (SheetGestures.tsx).
 *
 * With Gesture Handler 3 the ScrollView and FlatList of
 * react-native-actions-sheet, like React Native's own, compete with the
 * sheet's drag for every touch: content barely scrolls, and drags meant to
 * scroll move or close the sheet. The sheet's drag also starts after 5pt
 * and cancels the press under the finger, so a tap on a sheet's last
 * buttons that wobbled was lost. This keeps both out of the sheets below.
 * (The verse sheet and its screens are checked in
 * verse-actions/__tests__/verseSheetScrolling.test.ts.)
 */
import * as fs from 'fs';
import * as path from 'path';

const SHEETS_DIR = path.join(__dirname, '..');
const REPO = path.join(SHEETS_DIR, '..', '..');

const NOT_COVERED = new Set(['VerseActionsSheet.tsx', 'SheetGestures.tsx']);

const sheetFiles = [
  ...fs
    .readdirSync(SHEETS_DIR)
    .filter(name => name.endsWith('.tsx') && !NOT_COVERED.has(name))
    .map(name => path.join(SHEETS_DIR, name)),
  path.join(REPO, 'components', 'reciter-picker', 'ReciterPickerSheet.tsx'),
];

const read = (file: string) => fs.readFileSync(file, 'utf8');
const sheet = (name: string) => path.join(SHEETS_DIR, name);

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

/** The app's own source files under `dir`, tests and mocks left out. */
function appSources(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (['node_modules', '__tests__', '__mocks__'].includes(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) appSources(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const APP_DIRS = [
  'app',
  'components',
  'hooks',
  'modules',
  'packages',
  'services',
  'store',
  'utils',
];

/**
 * Sheets that still use React Native's own scroll views, and why that is
 * safe there.
 */
const NATIVE_SCROLL_VIEWS: Record<string, string> = {
  // Only as its ScrollComponent default; the sheet passes SheetScrollView.
  'MushafLayoutPanel.tsx': 'default never used in the sheet',
  // The accordion's nested list sits in a SheetNoDrag.
  'MushafPlayerOptionsSheet.tsx': 'inside SheetNoDrag',
  // The rewayah chips scroll sideways, which never drags the sheet.
  'OrganizeRecitationSheet.tsx': 'horizontal',
};

it('finds the sheets to check', () => {
  expect(sheetFiles.length).toBeGreaterThan(30);
  for (const file of sheetFiles) expect(fs.existsSync(file)).toBe(true);
});

it('scrolls nowhere in the scroll views of react-native-actions-sheet', () => {
  // Sheets and everything rendered in them (root search, theme picker).
  const files = APP_DIRS.flatMap(dir => appSources(path.join(REPO, dir)));
  expect(files.length).toBeGreaterThan(500);
  const offenders = files.filter(file =>
    importsFrom(read(file), 'react-native-actions-sheet').some(name =>
      SCROLLABLES.includes(name),
    ),
  );
  expect(offenders.map(file => path.relative(REPO, file))).toEqual([]);
});

it.each(sheetFiles.map(file => [path.basename(file), file]))(
  '%s uses React Native scroll views only where they cannot fight the drag',
  (name, file) => {
    const names = importsFrom(read(file), 'react-native');
    const scrollables = names.filter(n => SCROLLABLES.includes(n));
    if (scrollables.length > 0) {
      expect(NATIVE_SCROLL_VIEWS[name]).toBeDefined();
    }
  },
);

/** The element each `styles.stickyFooter` is the style of. */
function footerTags(file: string): string[] {
  return [
    ...read(file).matchAll(/<(\w+)\s+style=\{\[?\s*styles\.stickyFooter\b/g),
  ].map(m => m[1]);
}

it.each(sheetFiles.map(file => [path.basename(file), file]))(
  '%s keeps the sheet drag off its pinned footer',
  (_name, file) => {
    for (const tag of footerTags(file)) expect(tag).toBe('SheetFooter');
  },
);

it('finds the pinned footers it checks', () => {
  const withFooter = sheetFiles.filter(file => footerTags(file).length > 0);
  expect(withFooter.map(file => path.basename(file)).sort()).toEqual([
    'MushafPlayerOptionsSheet.tsx',
    'MushafRepeatOptionsSheet.tsx',
  ]);
});

/**
 * Each `<Pressable>` in a source, up to its closing tag, and whether a
 * SheetFooter holds it directly.
 */
function pressables(source: string): {text: string; inFooter: boolean}[] {
  return [...source.matchAll(/<Pressable\b/g)].map(m => {
    const start = m.index ?? 0;
    const end = source.indexOf('</Pressable>', start);
    const before = source.slice(0, start).trimEnd();
    return {
      text: source.slice(start, end === -1 ? undefined : end),
      inFooter: /<SheetFooter(\s[^<>]*)?>$/.test(before),
    };
  });
}

/**
 * The buttons sheets end with, each found by its style or its label: the
 * pinned Play and Start, Done, Save and Delete at the end of a list, and
 * the buttons of the short recitation sheets.
 */
const CLOSING_BUTTONS: [string, string][] = [
  ['AdhkarCopyOptionsSheet.tsx', 'styles.copyButton'],
  ['MushafPlayerOptionsSheet.tsx', 'styles.playButton'],
  ['MushafRepeatOptionsSheet.tsx', 'styles.playButton'],
  ['OrganizeRecitationSheet.tsx', 'styles.deleteButton'],
  ['RecitationIntroSheet.tsx', 'styles.primaryButton'],
  ['RecitationIntroSheet.tsx', 'styles.secondaryButton'],
  ['RecitationMistakeSheet.tsx', 'styles.primaryButton'],
  ['RecitationMistakeSheet.tsx', 'styles.secondaryButton'],
  ['RecitationPracticeSheet.tsx', 'styles.primaryButton'],
  ['RecitationPracticeSheet.tsx', "t('common:actions.done')"],
  ['RecitationSummarySheet.tsx', 'styles.doneButton'],
  ['SleepTimerSheet.tsx', 'styles.turnOffButton'],
  ['VerseNoteSheet.tsx', 'styles.saveButton'],
  ['VerseNoteSheet.tsx', 'styles.deleteButton'],
  ['WhichAyahSheet.tsx', 'styles.primaryButton'],
  ['WhichAyahSheet.tsx', 'styles.secondaryButton'],
];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

it.each(CLOSING_BUTTONS)(
  '%s holds the button with %s in a SheetFooter',
  (file, needle) => {
    const pattern = new RegExp(`${escape(needle)}(?![\\w])`);
    const found = pressables(read(sheet(file))).filter(p =>
      pattern.test(p.text),
    );
    expect(found.length).toBeGreaterThan(0);
    for (const button of found) expect(button.inFooter).toBe(true);
  },
);

it('keeps SheetNoDrag to the lists that scroll inside a sheet', () => {
  // SheetNoDrag holds the drag off only until the finger lifts, which does
  // not save a tap; it keeps a nested list scrolling in either direction.
  const users = sheetFiles.filter(file => /<SheetNoDrag\b/.test(read(file)));
  expect(users.map(file => path.basename(file)).sort()).toEqual([
    'MushafLayoutPanel.tsx', // the reading-theme picker
    'MushafPlayerOptionsSheet.tsx', // the accordion's list
  ]);
  for (const file of users) {
    expect(read(file)).not.toMatch(/<SheetNoDrag[^>]*>\s*<Pressable\b/);
  }
});
