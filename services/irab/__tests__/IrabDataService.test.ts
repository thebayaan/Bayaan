/**
 * IrabDataService delivery: a bundled database is imported once per file
 * name, so a rebuilt i'rab database reaches installed apps only under a new
 * name, and the copy an older release imported is deleted, on the first
 * open of every session and before anything is imported.
 *
 * expo-sqlite is replaced by a fake that keeps the native behaviour this
 * relies on: openDatabaseAsync creates a missing file (empty, no tables),
 * importDatabaseFromAssetAsync does nothing when the file exists and fails
 * when the disk has no room for the copy, and deleteDatabaseAsync throws for
 * a missing file.
 */

type FakeFile = 'empty' | 'asset';

jest.mock('expo-sqlite', () => {
  const files = new Map<string, FakeFile>();
  const log: string[] = [];
  // The room on the disk, in MB. An imported copy takes about 20 MB
  // (irab-v1.db is 20.8 MB, irab-v2.db 20.2 MB), an empty file next to
  // nothing.
  const disk = {mb: Infinity};
  const COPY_MB = 20;
  return {
    __fake: {files, log, disk},
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
      if (files.has(name)) return;
      const copies = [...files.values()].filter(file => file === 'asset');
      if ((copies.length + 1) * COPY_MB > disk.mb) {
        throw new Error('ENOSPC: no space left on device');
      }
      files.set(name, 'asset');
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
    __fake: {
      files: Map<string, FakeFile>;
      log: string[];
      disk: {mb: number};
    };
  }
).__fake;
/** The file the build writes; the service must open the same name. */
const NAME = `irab-v${DB_VERSION}.db`;
/** The copy v2.4.0 imported. */
const OLD = 'irab-v1.db';

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
  fake.disk.mb = Infinity;
});

it('imports the rebuilt database over the copy v2.4.0 imported', async () => {
  fake.files.set(OLD, 'asset');
  await freshService().initialize();
  expect(NAME).not.toBe(OLD);
  expect(fake.files.get(NAME)).toBe('asset');
  expect(fake.files.has(OLD)).toBe(false);
  expect(fake.log).toContain(`import:${NAME}`);
});

it('imports it on a fresh install', async () => {
  await freshService().initialize();
  expect([...fake.files]).toEqual([[NAME, 'asset']]);
});

it('opens an imported copy without importing again', async () => {
  fake.files.set(NAME, 'asset');
  await freshService().initialize();
  // The old name is tried first; that it is not there is no error.
  expect(fake.log).toEqual([`delete:${OLD}`, `open:${NAME}`]);
});

it('deletes the v2.4.0 copy before importing, so a nearly full phone has room', async () => {
  // Room for one copy: the import fits only once the old copy is gone.
  fake.files.set(OLD, 'asset');
  fake.disk.mb = 30;
  await freshService().initialize();
  expect([...fake.files]).toEqual([[NAME, 'asset']]);
  expect(fake.log.indexOf(`delete:${OLD}`)).toBeLessThan(
    fake.log.indexOf(`import:${NAME}`),
  );
});

it('frees the v2.4.0 copy even when the import fails for lack of space', async () => {
  fake.files.set(OLD, 'asset');
  fake.disk.mb = 10;
  await expect(freshService().initialize()).rejects.toThrow('ENOSPC');
  expect(fake.files.has(OLD)).toBe(false);
  expect(fake.log.indexOf(`delete:${OLD}`)).toBeLessThan(
    fake.log.indexOf(`import:${NAME}`),
  );
});

it('deletes a v2.4.0 copy an earlier session left, on a later launch', async () => {
  // The app was killed between the import and the delete, or the delete
  // failed: the next launch finds both copies.
  fake.files.set(OLD, 'asset');
  fake.files.set(NAME, 'asset');
  await freshService().initialize();
  expect([...fake.files]).toEqual([[NAME, 'asset']]);
  expect(fake.log).toEqual([`delete:${OLD}`, `open:${NAME}`]);
});
