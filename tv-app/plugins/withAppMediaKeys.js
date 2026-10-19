/**
 * Android TV: the remote's transport keys belong to the app while it is in
 * front.
 *
 * react-native-tvos hands Play/Pause, Play, Pause, Fast-forward, Rewind,
 * Next and Previous to JS (useTVEventHandler), where the player store toggles and seeks with
 * its own rules. Android then also passes the same unhandled key on to the
 * active media session, and expo-audio gives every player a basic media3
 * session that toggles the player itself (a beat later, after its double-tap
 * wait). So one Play/Pause press toggled twice: the first press looked like a
 * pause, and the second "resumed" only for the session to pause it again.
 *
 * This plugin makes MainActivity consume those keys once React Native has
 * seen them, so only the app acts. In the background the session still gets
 * them, as the activity is not in front.
 */
const {withMainActivity} = require('expo/config-plugins');

const MARKER = '// Bayaan: transport keys stay with the app';

// The keys react-native-tvos forwards to JS (ReactAndroidHWInputDeviceHelper).
// Play and Pause too: the app plays or pauses its own audio on them (the
// adhkar reader's, say), which the session must not answer with the Quran
// player.
const KEYS = [
  'KEYCODE_MEDIA_PLAY_PAUSE',
  'KEYCODE_MEDIA_PLAY',
  'KEYCODE_MEDIA_PAUSE',
  'KEYCODE_MEDIA_FAST_FORWARD',
  'KEYCODE_MEDIA_REWIND',
  'KEYCODE_MEDIA_NEXT',
  'KEYCODE_MEDIA_PREVIOUS',
];

const METHODS = `
  ${MARKER} (see plugins/withAppMediaKeys.js).
  private fun isAppMediaKey(keyCode: Int): Boolean =
      keyCode == ${KEYS.map(k => `KeyEvent.${k}`).join(' ||\n          keyCode == ')}

  override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean =
      super.onKeyDown(keyCode, event) || isAppMediaKey(keyCode)

  override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean =
      super.onKeyUp(keyCode, event) || isAppMediaKey(keyCode)
`;

/** Adds the overrides to MainActivity.kt's source (once). */
function addMediaKeyOverrides(src) {
  if (src.includes(MARKER)) return src;
  if (/override fun onKey(Down|Up)\(/.test(src)) {
    throw new Error(
      'withAppMediaKeys: MainActivity already overrides onKeyDown/onKeyUp; merge the transport keys by hand.',
    );
  }
  let out = src;
  if (!/^import android\.view\.KeyEvent$/m.test(out)) {
    out = out.replace(
      /^(package [^\n]+\n)/,
      '$1\nimport android.view.KeyEvent\n',
    );
  }
  const classStart = out.search(/class MainActivity[^{]*\{/);
  if (classStart < 0) {
    throw new Error('withAppMediaKeys: MainActivity class not found.');
  }
  const brace = out.indexOf('{', classStart);
  return out.slice(0, brace + 1) + '\n' + METHODS + out.slice(brace + 1);
}

function withAppMediaKeys(config) {
  return withMainActivity(config, mod => {
    if (mod.modResults.language !== 'kt') {
      throw new Error('withAppMediaKeys: expected a Kotlin MainActivity.');
    }
    mod.modResults.contents = addMediaKeyOverrides(mod.modResults.contents);
    return mod;
  });
}

module.exports = withAppMediaKeys;
module.exports.addMediaKeyOverrides = addMediaKeyOverrides;
