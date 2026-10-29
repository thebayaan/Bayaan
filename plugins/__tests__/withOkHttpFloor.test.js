/**
 * Unit tests for plugins/withOkHttpFloor.js: the Gradle constraints that keep
 * OkHttp at 4.12.1 or newer.
 */

const fs = require('fs');
const path = require('path');
const {addOkHttpFloor} = require('../withOkHttpFloor');

// The committed native tree must match what the plugin would generate.
const BUILD_GRADLE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'android', 'app', 'build.gradle'),
  'utf8',
);

function stripFloor(src) {
  return src.replace(
    / {4}\/\/ @bayaan-okhttp start\n[\s\S]*?\/\/ @bayaan-okhttp end\n\n/,
    '',
  );
}

describe('addOkHttpFloor', () => {
  it('leaves the committed build.gradle unchanged', () => {
    expect(addOkHttpFloor(BUILD_GRADLE)).toBe(BUILD_GRADLE);
  });

  it('turns a build.gradle without the floor into the committed one', () => {
    const stripped = stripFloor(BUILD_GRADLE);
    expect(stripped).not.toContain('okhttp3');
    expect(addOkHttpFloor(stripped)).toBe(BUILD_GRADLE);
  });

  it('constrains both OkHttp artifacts to 4.12.1, once', () => {
    const out = addOkHttpFloor(stripFloor(BUILD_GRADLE));
    expect(addOkHttpFloor(out)).toBe(out);
    expect(out.match(/@bayaan-okhttp start/g)).toHaveLength(1);
    expect(out).toContain(
      'implementation("com.squareup.okhttp3:okhttp:4.12.1")',
    );
    expect(out).toContain(
      'implementation("com.squareup.okhttp3:okhttp-urlconnection:4.12.1")',
    );
  });

  it('throws when the dependencies block is missing', () => {
    expect(() =>
      addOkHttpFloor(
        stripFloor(BUILD_GRADLE).replace('\ndependencies {\n', '\n'),
      ),
    ).toThrow(/ANCHOR/);
  });
});
