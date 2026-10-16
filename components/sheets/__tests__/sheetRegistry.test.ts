// @ai-generated
/**
 * The sheet registry (sheets.tsx) holds no verse sheet that nothing opens,
 * and no registered sheet shows or copies Arabic text handed to it by its
 * caller.
 *
 * Release 1 made every verse surface read its Arabic text from the words DB
 * of the rewayah on its label. Four verse sheets that nothing opens any more
 * (copy, share, highlight, similar verses) stayed registered, and the copy
 * sheet still copied caller-supplied text under a "Quran 2:255" citation
 * with no rewayah: opening it again would have revived that path. The app
 * opens sheets with literal names (SheetManager.show('name')), so a scan of
 * the source finds every sheet that is reachable.
 */
import * as fs from 'fs';
import * as path from 'path';
import type {Sheets} from 'react-native-actions-sheet';

const REPO = path.join(__dirname, '..', '..', '..');
const SHEETS_DIR = path.join(__dirname, '..');
const sheetsSource = fs.readFileSync(
  path.join(SHEETS_DIR, 'sheets.tsx'),
  'utf8',
);

/** The app's source files under `dir` (tests excluded). */
function appSources(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) appSources(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** registerSheet('name', Component): name → Component. */
const registered = new Map(
  [...sheetsSource.matchAll(/registerSheet\(\s*'([^']+)',\s*(\w+)\s*\)/g)].map(
    m => [m[1], m[2]] as const,
  ),
);

/** import {Component} from './File': Component → source file. */
function moduleOf(component: string): string | null {
  const m = new RegExp(`import \\{${component}\\} from '\\./([\\w-]+)'`).exec(
    sheetsSource,
  );
  if (!m) return null;
  for (const ext of ['.tsx', '.ts']) {
    const file = path.join(SHEETS_DIR, `${m[1]}${ext}`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/** Every sheet name passed to SheetManager.show, and any non-literal call. */
const opened = (() => {
  const names = new Set<string>();
  const nonLiteral: string[] = [];
  for (const dir of [
    'app',
    'components',
    'hooks',
    'services',
    'store',
    'utils',
  ]) {
    for (const file of appSources(path.join(REPO, dir))) {
      const source = fs.readFileSync(file, 'utf8');
      for (const m of source.matchAll(/SheetManager\.show\(\s*([^,)]*)/g)) {
        const literal = /^['"]([^'"]+)['"]$/.exec(m[1].trim());
        if (literal) names.add(literal[1]);
        else nonLiteral.push(`${path.relative(REPO, file)}: ${m[1].trim()}`);
      }
    }
  }
  return {names, nonLiteral};
})();

const VERSE_SHEETS_NOTHING_OPENS = [
  'verse-copy',
  'verse-share',
  'verse-highlight',
  'similar-verses',
];

describe('sheet registry', () => {
  it('sees every sheet the app opens (all opened by literal name)', () => {
    expect(opened.nonLiteral).toEqual([]);
    expect(opened.names.has('verse-actions')).toBe(true);
    expect(registered.has('verse-actions')).toBe(true);
  });

  it('does not register the verse sheets nothing opens', () => {
    for (const name of VERSE_SHEETS_NOTHING_OPENS) {
      expect([name, opened.names.has(name)]).toEqual([name, false]);
    }
    expect(VERSE_SHEETS_NOTHING_OPENS.filter(n => registered.has(n))).toEqual(
      [],
    );
  });

  it('registers no sheet that takes Arabic text from its caller', () => {
    expect(registered.size).toBeGreaterThan(20);
    const takesCallerText: string[] = [];
    for (const [name, component] of registered) {
      const file = moduleOf(component);
      expect([name, file !== null]).toEqual([name, true]);
      const source = file ? fs.readFileSync(file, 'utf8') : '';
      if (/payload\??\.arabicText/.test(source)) takesCallerText.push(name);
    }
    expect(takesCallerText).toEqual([]);
  });
});

// Compile-time check (tsc): the verse actions sheet reads the Arabic text
// from the words DB of its rewayah itself, so its payload has no field for
// a caller-supplied string of unknown rewayah.
const verseActionsPayload: Sheets['verse-actions']['payload'] = {
  verseKey: '2:255',
  surahNumber: 2,
  ayahNumber: 255,
  // @ts-expect-error -- not a field of the verse actions payload
  arabicText: 'caller-supplied text',
};

it('keeps the verse actions payload free of Arabic text (checked by tsc)', () => {
  expect(verseActionsPayload.verseKey).toBe('2:255');
});
