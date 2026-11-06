// @ai-generated
/**
 * scripts/generate-version.js must derive the version of the repository that
 * holds the script, whatever the caller's cwd. Before, every git call ran in
 * process.cwd(): a build for one worktree, started from a shell in another
 * checkout, took the other checkout's tag and commit count.
 *
 * These tests run the derive from a foreign git repo and from a directory
 * outside any repo, and compare the result with a run from the repo root.
 * The checks also hold in a shallow CI clone (commit count 1, no tags).
 */

const {execFileSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'generate-version.js');
const REPO_ROOT = path.join(__dirname, '..', '..');

// BUILD_NUMBER overrides the derive; keep a caller's value out of the child.
const childEnv = {...process.env};
delete childEnv.BUILD_NUMBER;

function derive(cwd) {
  const out = execFileSync('node', [SCRIPT, '--json-only'], {
    cwd,
    env: childEnv,
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

function git(cwd, args) {
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    {cwd, env: childEnv, encoding: 'utf8'},
  );
}

describe('generate-version.js is independent of cwd', () => {
  let scratch;
  let foreignRepo;
  let plainDir;
  let expected;

  beforeAll(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-version-cwd-'));

    // A foreign repo with a version tag that this repo does not carry, so a
    // cwd-relative derive gives a visibly wrong version and hash.
    foreignRepo = path.join(scratch, 'foreign');
    fs.mkdirSync(foreignRepo);
    git(foreignRepo, ['init', '-q']);
    git(foreignRepo, ['commit', '-q', '--allow-empty', '-m', 'only commit']);
    git(foreignRepo, ['tag', 'v99.98.97']);

    plainDir = path.join(scratch, 'plain');
    fs.mkdirSync(plainDir);

    expected = derive(REPO_ROOT);
  });

  afterAll(() => {
    fs.rmSync(scratch, {recursive: true, force: true});
  });

  it('derives from the repo root as a baseline', () => {
    expect(expected.gitHash).toBe(
      git(REPO_ROOT, ['rev-parse', '--short', 'HEAD']).trim(),
    );
  });

  it("gives the script's repo version from inside a different git repo", () => {
    const got = derive(foreignRepo);
    expect(got.semanticVersion).not.toBe('99.98.97');
    expect(got.semanticVersion).toBe(expected.semanticVersion);
    expect(got.buildNumber).toBe(expected.buildNumber);
    expect(got.versionCode).toBe(expected.versionCode);
    expect(got.gitHash).toBe(expected.gitHash);
    expect(got.gitBranch).toBe(expected.gitBranch);
  });

  it("gives the script's repo version from outside any git repo", () => {
    const got = derive(plainDir);
    expect(got.semanticVersion).toBe(expected.semanticVersion);
    expect(got.buildNumber).toBe(expected.buildNumber);
    expect(got.gitHash).toBe(expected.gitHash);
  });
});
