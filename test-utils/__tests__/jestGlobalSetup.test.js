// @ai-generated
const {spawnSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const globalTeardown = require('../jestGlobalTeardown');
const {makeRoot, removeStaleRoots} = require('../jestGlobalSetup');

describe('the temp root of a Jest run', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-root-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  it('exists for this run, under the OS temp directory', () => {
    const root = process.env.BAYAAN_JEST_SQLITE_ROOT;
    expect(root).toBeTruthy();
    expect(fs.statSync(root).isDirectory()).toBe(true);
    expect(path.basename(root)).toMatch(/^bayaan-jest-sqlite-\d+-/);
  });

  it('removes a root whose process is gone', () => {
    const {pid: gone} = spawnSync(process.execPath, ['--version']);
    const stale = path.join(tmpDir, `bayaan-jest-sqlite-${gone}-abc`);
    fs.mkdirSync(path.join(stale, 'expo-sqlite-1'), {recursive: true});

    removeStaleRoots(tmpDir);

    expect(fs.existsSync(stale)).toBe(false);
  });

  it('keeps the root of a run that is still going', () => {
    const live = makeRoot(tmpDir);

    removeStaleRoots(tmpDir);

    expect(fs.existsSync(live)).toBe(true);
  });

  it('keeps a folder with another name', () => {
    const other = path.join(tmpDir, 'bayaan-other');
    fs.mkdirSync(other);

    removeStaleRoots(tmpDir);

    expect(fs.existsSync(other)).toBe(true);
  });

  it('removes the root and all that it holds at teardown', async () => {
    const root = makeRoot(tmpDir);
    fs.mkdirSync(path.join(root, 'expo-sqlite-1'));
    fs.writeFileSync(path.join(root, 'expo-sqlite-1', 'a.db'), 'a');
    const saved = process.env.BAYAAN_JEST_SQLITE_ROOT;
    process.env.BAYAAN_JEST_SQLITE_ROOT = root;

    await globalTeardown();
    process.env.BAYAAN_JEST_SQLITE_ROOT = saved;

    expect(fs.existsSync(root)).toBe(false);
  });
});
