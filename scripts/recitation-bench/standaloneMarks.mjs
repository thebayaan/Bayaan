/* eslint-env node, es2020 */
// wordMarks.ts reads its tuned numbers from the NPL file, and a replay compiles the
// rules to one file under .out. This puts the numbers in as a plain object there. A copy
// of the rules from before they moved has no such import, and comes back as it is.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const NUMBERS = path.resolve(
  HERE,
  '../../services/recitation/followerConstants.npl.json',
);
const IMPORT = "import followerConstants from './followerConstants.npl.json';";

export function standaloneMarks(source) {
  return source.replace(
    IMPORT,
    `const followerConstants = ${fs.readFileSync(NUMBERS, 'utf8')};`,
  );
}
