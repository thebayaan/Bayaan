// @ai-generated
/**
 * Every sheet presents as a native SwiftUI sheet on iPhone: each id
 * registered with react-native-actions-sheet in sheets.tsx is registered
 * with registerNativeSheet too, and nothing opens a sheet past sheetControl.
 */
import * as fs from 'fs';
import * as path from 'path';

const SHEETS_DIR = path.join(__dirname, '..');
const REPO = path.join(SHEETS_DIR, '..', '..');
const source = fs.readFileSync(path.join(SHEETS_DIR, 'sheets.tsx'), 'utf8');

const ids = (call: string) =>
  [...source.matchAll(new RegExp(`${call}\\('([^']+)'`, 'g'))].map(m => m[1]);

it('registers every sheet as a native sheet', () => {
  const sheets = ids('registerSheet');
  expect(sheets.length).toBeGreaterThan(30);
  const native = new Set(ids('registerNativeSheet'));
  expect(sheets.filter(id => !native.has(id))).toEqual([]);
});

function appSources(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (['node_modules', '__tests__', '__mocks__'].includes(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) appSources(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

it('opens and closes sheets only through sheetControl', () => {
  const files = ['app', 'components', 'hooks', 'services', 'store', 'utils']
    .flatMap(dir => appSources(path.join(REPO, dir)))
    .filter(file => !file.endsWith(path.join('sheets', 'sheetControl.tsx')));
  const offenders = files.filter(file =>
    /SheetManager\.(show|hide|hideAll)\(/.test(
      // Comments may name SheetManager.
      fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, ''),
    ),
  );
  expect(offenders.map(file => path.relative(REPO, file))).toEqual([]);
});
