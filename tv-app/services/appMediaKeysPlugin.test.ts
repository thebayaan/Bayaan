// The config plugin that keeps Android TV's transport keys from also
// reaching expo-audio's media session (plugins/withAppMediaKeys.js).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {addMediaKeyOverrides} = require('../plugins/withAppMediaKeys') as {
  addMediaKeyOverrides: (src: string) => string;
};

const MAIN_ACTIVITY = `package com.bayaan.tvsmoke
import expo.modules.splashscreen.SplashScreenManager

import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;

describe('withAppMediaKeys', () => {
  it('consumes the transport keys after React Native has seen them', () => {
    const out = addMediaKeyOverrides(MAIN_ACTIVITY);
    expect(out).toContain('import android.view.KeyEvent');
    expect(out).toContain(
      'super.onKeyDown(keyCode, event) || isAppMediaKey(keyCode)',
    );
    expect(out).toContain(
      'super.onKeyUp(keyCode, event) || isAppMediaKey(keyCode)',
    );
    for (const key of [
      'PLAY_PAUSE',
      'FAST_FORWARD',
      'REWIND',
      'NEXT',
      'PREVIOUS',
    ]) {
      expect(out).toContain(`KeyEvent.KEYCODE_MEDIA_${key}`);
    }
    // Inside the class, before its first member.
    expect(out.indexOf('isAppMediaKey')).toBeGreaterThan(
      out.indexOf('class MainActivity'),
    );
    expect(out.indexOf('isAppMediaKey')).toBeLessThan(
      out.indexOf('getMainComponentName'),
    );
  });

  it('adds them once', () => {
    const once = addMediaKeyOverrides(MAIN_ACTIVITY);
    expect(addMediaKeyOverrides(once)).toBe(once);
  });

  it('refuses to clobber an existing key override', () => {
    const custom = MAIN_ACTIVITY.replace(
      '  override fun getMainComponentName',
      '  override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean = false\n  override fun getMainComponentName',
    );
    expect(() => addMediaKeyOverrides(custom)).toThrow(/merge/);
  });
});
