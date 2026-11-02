// @ai-generated
/**
 * Makes one temp root for the expo-sqlite mock, for one Jest run. The workers
 * inherit its path through the environment, so no suite tracks a folder, and
 * jestGlobalTeardown.js removes all of it, also after a failed or crashed test.
 *
 * A killed Jest process runs no teardown. The name of a root holds the pid of
 * its run, so the next run removes a root whose process is gone. It keeps the
 * root of a run that is still going, for example in another checkout.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT_PREFIX = 'bayaan-jest-sqlite-';

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists, and another user owns it.
    return error.code === 'EPERM';
  }
}

function removeStaleRoots(tmpDir) {
  for (const name of fs.readdirSync(tmpDir)) {
    if (!name.startsWith(ROOT_PREFIX)) continue;
    const pid = Number.parseInt(name.slice(ROOT_PREFIX.length), 10);
    if (Number.isNaN(pid) || isRunning(pid)) continue;
    try {
      fs.rmSync(path.join(tmpDir, name), {recursive: true, force: true});
    } catch {
      // A leftover folder must not fail this run, for example another user's.
    }
  }
}

function makeRoot(tmpDir) {
  return fs.mkdtempSync(path.join(tmpDir, `${ROOT_PREFIX}${process.pid}-`));
}

module.exports = async function globalSetup() {
  removeStaleRoots(os.tmpdir());
  process.env.BAYAAN_JEST_SQLITE_ROOT = makeRoot(os.tmpdir());
};
module.exports.removeStaleRoots = removeStaleRoots;
module.exports.makeRoot = makeRoot;
