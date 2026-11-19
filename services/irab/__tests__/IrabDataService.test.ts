/**
 * IrabDataService delivery: a bundled database is imported once per file
 * name, so a rebuilt i'rab database reaches installed apps only under a new
 * name, and the copy an older release imported is deleted.
 *
 * expo-sqlite is replaced by a fake that keeps the native behaviour this
 * relies on: openDatabaseAsync creates a missing file (empty, no tables),
 * importDatabaseFromAssetAsync does nothing when the file exists, and
 * deleteDatabaseAsync throws for a missing file.
 */

type FakeFile = 'empty' | 'asset';

jest.mock('expo-sqlite', () => {
  const files = new Map<string, FakeFile>();
  const log: string[] = [];
  return {
    __fake: {files, log},
    async openDatabaseAsync(name: string) {
      log.push(`open:${name}`);
      if (!files.has(name)) files.set(name, 'empty');
      return {
        async getFirstAsync() {
          return files.get(name) === 'asset' ? {name: 'morph'} : null;
        },
        async getAllAsync() {
          return [];
        },
        async closeAsync() {
          log.push(`close:${name}`);
        },
      };
    },
    async importDatabaseFromAssetAsync(name: string) {
      log.push(`import:${name}`);
      if (!files.has(name)) files.set(name, 'asset');
    },
    async deleteDatabaseAsync(name: string) {
      log.push(`delete:${name}`);
      if (!files.delete(name)) throw new Error(`no database ${name}`);
    },
  };
});

import {DB_VERSION} from '../../../scripts/irab/build-irab-db';

const fake = (
  jest.requireMock('expo-sqlite') as {
    __fake: {files: Map<string, FakeFile>; log: string[]};
  }
).__fake;
/** The file the build writes; the service must open the same name. */
const NAME = `irab-v${DB_VERSION}.db`;

function freshService() {
  let service!: typeof import('../IrabDataService').irabDataService;
  jest.isolateModules(() => {
    service = require('../IrabDataService').irabDataService;
  });
  return service;
}

beforeEach(() => {
  fake.files.clear();
  fake.log.length = 0;
});

it('imports the rebuilt database over the copy v2.4.0 imported', async () => {
  fake.files.set('irab-v1.db', 'asset');
  await freshService().initialize();
  expect(NAME).not.toBe('irab-v1.db');
  expect(fake.files.get(NAME)).toBe('asset');
  expect(fake.files.has('irab-v1.db')).toBe(false);
  expect(fake.log).toContain(`import:${NAME}`);
});

it('imports it on a fresh install', async () => {
  await freshService().initialize();
  expect([...fake.files]).toEqual([[NAME, 'asset']]);
});

it('opens an imported copy without importing again', async () => {
  fake.files.set(NAME, 'asset');
  await freshService().initialize();
  expect(fake.log).toEqual([`open:${NAME}`]);
});
