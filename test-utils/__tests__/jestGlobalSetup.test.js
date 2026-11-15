// @ai-generated
const {spawnSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {makeRoot, removeStaleRoots} = require('../jestGlobalSetup');

describe('the temp root of a Jest run', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-root-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  it('is the temp directory of this worker', () => {
    expect(path.basename(os.tmpdir())).toMatch(/^bayaan-jest-tmp-\d+-/);
    expect(fs.statSync(os.tmpdir()).isDirectory()).toBe(true);
  });

  it('removes a root whose process is gone', () => {
    const {pid: gone} = spawnSync(process.execPath, ['--version']);
    const stale = path.join(tmpDir, `bayaan-jest-tmp-${gone}-abc`);
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

  // A plain node process, because os.tmpdir() reads the real environment and a
  // suite only has a copy. Two runs in one process, as in watch mode.
  it('moves os.tmpdir() to the root and back, and removes the root', () => {
    const script = `
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const setup = require(${JSON.stringify(require.resolve('../jestGlobalSetup'))});
      const teardown = require(${JSON.stringify(require.resolve('../jestGlobalTeardown'))});
      (async () => {
        for (let run = 0; run < 2; run++) {
          await setup();
          const root = os.tmpdir();
          fs.mkdirSync(path.join(root, 'expo-sqlite-1'));
          await teardown();
          console.log(JSON.stringify({root, kept: fs.existsSync(root), after: os.tmpdir()}));
        }
      })();
    `;
    const {status, stdout, stderr} = spawnSync(
      process.execPath,
      ['-e', script],
      {
        encoding: 'utf8',
        env: {...process.env, TMPDIR: tmpDir, TEMP: tmpDir, TMP: tmpDir},
      },
    );

    expect(stderr).toBe('');
    expect(status).toBe(0);
    const runs = stdout.trim().split('\n').map(JSON.parse);
    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect(path.dirname(run.root)).toBe(tmpDir);
      expect(path.basename(run.root)).toMatch(/^bayaan-jest-tmp-\d+-/);
      expect(run.kept).toBe(false);
      expect(run.after).toBe(tmpDir);
    }
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });
});
