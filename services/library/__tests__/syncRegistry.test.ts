// @ai-generated
// docs/architecture/sync-registry.md must classify every persisted store and
// every SQLite table as synced or device-only, so nothing new ships without a
// decision about cross-device sync. Sources are read as text.

import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const SKIP = new Set([
  'node_modules',
  'ios',
  'android',
  'assets',
  '__tests__',
  '__mocks__',
  'docs',
  'scripts',
]);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const registry = fs.readFileSync(
  path.join(root, 'docs/architecture/sync-registry.md'),
  'utf8',
);
const sources = sourceFiles(root).map(file => ({
  file: path.relative(root, file).split(path.sep).join('/'),
  text: fs.readFileSync(file, 'utf8'),
}));

function listed(name: string): boolean {
  return registry.includes(`\`${name}\``);
}

describe('sync registry', () => {
  it('classifies every persisted Zustand store', () => {
    const stores = sources
      .filter(
        ({text}) =>
          /from ['"]zustand\/middleware['"]/.test(text) &&
          /\bpersist\(/.test(text),
      )
      .map(({file}) => file);
    expect(stores.length).toBeGreaterThan(0);
    expect(stores.filter(file => !listed(file))).toEqual([]);
  });

  it('classifies every SQLite table', () => {
    const tables = new Set<string>();
    for (const {text} of sources) {
      for (const match of text.matchAll(
        /CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)\s*\(/g,
      )) {
        tables.add(match[1]);
      }
    }
    expect(tables.size).toBeGreaterThan(0);
    expect([...tables].filter(table => !listed(table)).sort()).toEqual([]);
  });
});
