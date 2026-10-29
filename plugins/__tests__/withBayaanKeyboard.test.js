/**
 * Unit tests for plugins/withBayaanKeyboard.js: the app delegate methods
 * that hand iPad keyboard shortcuts to modules/bayaan-keyboard.
 */

const fs = require('fs');
const path = require('path');
const {addKeyboardToAppDelegate} = require('../withBayaanKeyboard');

// The committed native tree must match what the plugin would generate.
const APP_DELEGATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'ios', 'Bayaan', 'AppDelegate.swift'),
  'utf8',
);

function stripKeyboard(src) {
  return src
    .replace(
      /\n {2}\/\/ @bayaan-keyboard start\n[\s\S]*?\/\/ @bayaan-keyboard end\n/,
      '',
    )
    .replace('internal import BayaanKeyboard\n', '');
}

describe('addKeyboardToAppDelegate', () => {
  it('leaves the committed app delegate unchanged', () => {
    expect(addKeyboardToAppDelegate(APP_DELEGATE)).toBe(APP_DELEGATE);
  });

  it('turns an app delegate without the shortcuts into the committed one', () => {
    const stripped = stripKeyboard(APP_DELEGATE);
    expect(stripped).not.toContain('KeyCommandCenter');
    expect(addKeyboardToAppDelegate(stripped)).toBe(APP_DELEGATE);
  });

  it('adds the block and the import once', () => {
    const out = addKeyboardToAppDelegate(stripKeyboard(APP_DELEGATE));
    expect(addKeyboardToAppDelegate(out)).toBe(out);
    expect(out.match(/@bayaan-keyboard start/g)).toHaveLength(1);
    expect(out.match(/internal import BayaanKeyboard/g)).toHaveLength(1);
    expect(out).toContain(
      'override func buildMenu(with builder: UIMenuBuilder)',
    );
    expect(out).toContain(
      '@objc func bayaanKeyCommand(_ sender: UIKeyCommand)',
    );
  });

  it('throws when an anchor is missing', () => {
    const stripped = stripKeyboard(APP_DELEGATE);
    expect(() =>
      addKeyboardToAppDelegate(
        stripped.replace('didFinishLaunchingWithOptions: launchOptions)', ''),
      ),
    ).toThrow(/BLOCK_ANCHOR/);
    expect(() =>
      addKeyboardToAppDelegate(
        stripped.replace('import ReactAppDependencyProvider\n', ''),
      ),
    ).toThrow(/IMPORT_ANCHOR/);
  });
});
