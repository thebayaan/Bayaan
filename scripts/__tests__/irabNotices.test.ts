/**
 * The licence notices the i'rab build copies into its database's meta table
 * (see THIRD_PARTY_LICENSES.md, Quran i'rab). They stay exactly as their
 * owners published them: a change here must be a new upstream text.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {NOTICE_FILES} from '../irab/build-irab-db';

const root = path.join(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file));
const sha256 = (file: string) =>
  crypto.createHash('sha256').update(read(file)).digest('hex');

it('keeps the Quranic Treebank licence from the pinned commit', () => {
  const text = read(NOTICE_FILES.treebank_notice).toString('utf8');
  expect(text.split('\n')[0]).toBe('MIT License');
  expect(text).toContain('shall be included in all');
  expect(sha256(NOTICE_FILES.treebank_notice)).toBe(
    '67fecc5f5049dedccb8b2a27b5d589eae359e795fbe88b70d438a90bb1e33f9c',
  );
});

it('keeps the Quranic Arabic Corpus notice and terms of use', () => {
  const text = read(NOTICE_FILES.qac_notice).toString('utf8');
  expect(text.split('\n')[0]).toBe('#  Quranic Arabic Corpus (Version 0.4)');
  expect(text).toContain('#  License: GNU General Public License\n');
  expect(text).toContain('CHANGING IT IS NOT ALLOWED');
  expect(sha256(NOTICE_FILES.qac_notice)).toBe(
    '1e9ee924029eb8b76e81b7584310b894d847f7caa9c8e27b282a41ba43675c03',
  );
});

it('is quoted word for word in THIRD_PARTY_LICENSES.md', () => {
  const doc = read('THIRD_PARTY_LICENSES.md').toString('utf8');
  const quoted = read(NOTICE_FILES.qac_notice)
    .toString('utf8')
    .trimEnd()
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
  expect(doc).toContain(quoted);
  expect(doc).toContain('licenses/NoorBayan-Quranic-MIT.txt');
});

it("ships the GPL version 3 text the corpus's licence page gives", () => {
  expect(sha256('licenses/GPL-3.0.txt')).toBe(
    '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986',
  );
});
