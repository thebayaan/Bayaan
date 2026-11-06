/**
 * Unit tests for the AppDelegate edits in plugins/withBayaanCar.js, against
 * the Expo SDK 58 template (fixtures/AppDelegate.sdk58.swift, copied from
 * expo/template.tgz). When an Expo upgrade changes the template, refresh the
 * fixture: a failing anchor here is what would fail `expo prebuild`.
 */

const fs = require('fs');
const path = require('path');
const {
  applySceneAppDelegate,
  applySiriAppDelegate,
} = require('../withBayaanCar');
const {addKeyboardToAppDelegate} = require('../withBayaanKeyboard');

const ROOT = path.join(__dirname, '..', '..');
const TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'AppDelegate.sdk58.swift'),
  'utf8',
);

// Expo runs AppDelegate mods last-registered first, and app.config.js
// registers withBayaanKeyboard after withBayaanCar.
function applyAll(src) {
  return applySceneAppDelegate(
    applySiriAppDelegate(addKeyboardToAppDelegate(src)),
  );
}

describe('withBayaanCar AppDelegate', () => {
  it('starts React Native through the scene bridge before the super call', () => {
    const out = applySceneAppDelegate(TEMPLATE);
    const bridge = out.indexOf('BayaanCarSceneBridge.shared.configure(');
    const superCall = out.indexOf(
      'return super.application(application, didFinishLaunchingWithOptions: launchOptions)',
    );
    expect(bridge).toBeGreaterThan(-1);
    expect(bridge).toBeLessThan(superCall);
    expect(out).toContain('import React\ninternal import BayaanCar\n');
  });

  it('adds the Siri handlers inside the AppDelegate class', () => {
    const out = applySiriAppDelegate(TEMPLATE);
    const handler = out.indexOf('BayaanCarSiri.handler(for: intent)');
    expect(handler).toBeGreaterThan(-1);
    expect(handler).toBeLessThan(out.indexOf('class ReactNativeDelegate'));
    expect(out).toContain('import Intents\n');
  });

  it('is idempotent', () => {
    const once = applyAll(TEMPLATE);
    expect(applyAll(once)).toBe(once);
  });

  it('fails loudly when the template changes', () => {
    expect(() => applySceneAppDelegate('import React\n')).toThrow(
      /BRIDGE_ANCHOR/,
    );
    expect(() => applySiriAppDelegate('import React\n')).toThrow(/SIRI_ANCHOR/);
  });

  it('matches the committed AppDelegate and SceneDelegate', () => {
    const committed = fs.readFileSync(
      path.join(ROOT, 'ios', 'Bayaan', 'AppDelegate.swift'),
      'utf8',
    );
    expect(committed).toBe(applyAll(TEMPLATE));
    expect(
      fs.readFileSync(
        path.join(ROOT, 'ios', 'Bayaan', 'SceneDelegate.swift'),
        'utf8',
      ),
    ).toBe(
      fs.readFileSync(
        path.join(__dirname, '..', 'bayaan-car', 'SceneDelegate.swift'),
        'utf8',
      ),
    );
  });
});
