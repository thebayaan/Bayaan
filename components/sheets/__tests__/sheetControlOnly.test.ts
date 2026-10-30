// @ai-generated
/**
 * Sheets open and close only through sheetControl (showSheet, hideSheet,
 * hideAllSheets, hideTopSheet).
 *
 * A direct SheetManager.show presents a react-native-actions-sheet modal
 * even while a native sheet is up, which leaves the app unresponsive, and
 * skips the guard against presenting the same sheet twice. A direct
 * SheetManager.hide can't close a sheet presented natively.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.join(__dirname, '..', '..', '..');
const ROOTS = ['app', 'components', 'hooks', 'services', 'utils', 'store'];
const ALLOWED = new Set([
  path.join('components', 'sheets', 'sheetControl.tsx'),
]);

function sources(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sources(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('sheet control', () => {
  it('imports SheetManager only in sheetControl', () => {
    const offenders = ROOTS.flatMap(root => sources(path.join(REPO, root)))
      .filter(file => !ALLOWED.has(path.relative(REPO, file)))
      .filter(file =>
        /import\s*\{[^}]*\bSheetManager\b[^}]*\}\s*from\s*'react-native-actions-sheet'/.test(
          fs.readFileSync(file, 'utf8'),
        ),
      )
      .map(file => path.relative(REPO, file));
    expect(offenders).toEqual([]);
  });
});
