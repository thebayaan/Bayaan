// @ai-generated
/**
 * scripts/generate-version.js must not take the marketing version from a
 * prerelease or test tag. `git describe` picks the NEAREST tag that matches
 * `v*.*.*`, and the glob also matches `v2.3.0-1809-test` (the tag on the
 * develop tip), so the derive gave `2.3.0-1809-test`.
 *
 * The test makes a throwaway repo with that shape and runs a copy of the
 * script in it.
 */

const {execFileSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'generate-version.js');

// BUILD_NUMBER overrides the derive; keep a caller's value out of the child.
const childEnv = {...process.env};
delete childEnv.BUILD_NUMBER;

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
      '-c',
      'tag.gpgsign=false',
      ...args,
    ],
    {cwd, env: childEnv, encoding: 'utf8'},
  );
}

describe('generate-version.js ignores prerelease and test tags', () => {
  let scratch;
  let repo;

  beforeAll(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-version-tags-'));
    repo = path.join(scratch, 'repo');
    fs.mkdirSync(path.join(repo, 'scripts'), {recursive: true});
    fs.copyFileSync(SCRIPT, path.join(repo, 'scripts', 'generate-version.js'));
    fs.writeFileSync(
      path.join(repo, 'package.json'),
      JSON.stringify({name: 'tmp', version: '1.0.0'}),
    );
    git(repo, ['init', '-q']);
    git(repo, ['add', '.']);
    git(repo, ['commit', '-q', '-m', 'release']);
    git(repo, ['tag', 'v2.3.0']);
    // A later commit with a test tag: nearer to HEAD than v2.3.0.
    git(repo, ['commit', '-q', '--allow-empty', '-m', 'test build']);
    git(repo, ['tag', 'v2.3.0-1809-test']);
    git(repo, ['commit', '-q', '--allow-empty', '-m', 'more work']);
  });

  afterAll(() => {
    fs.rmSync(scratch, {recursive: true, force: true});
  });

  it('derives 2.3.0, not the nearer v2.3.0-1809-test', () => {
    const out = execFileSync(
      'node',
      [path.join(repo, 'scripts', 'generate-version.js'), '--json-only'],
      {cwd: repo, env: childEnv, encoding: 'utf8'},
    );
    expect(JSON.parse(out).semanticVersion).toBe('2.3.0');
  });
});
